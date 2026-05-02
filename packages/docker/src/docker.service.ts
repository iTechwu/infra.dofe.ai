import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { ConfigService } from '@nestjs/config';
import Docker from 'dockerode';
import { isAbsolute, join } from 'node:path';
import {
  readdir as _readdir,
  rm as _rm,
  stat as _stat,
} from 'node:fs/promises';
import { PROVIDER_CONFIGS, getOpenclawNativeProvider } from './types';
import type {
  ContainerStats,
  OrphanReport,
  CleanupReport,
  ProviderVendor,
  BotType,
} from './types';
import { normalizeModelName } from '@dofe/infra-utils';
import { DockerImageService } from './docker-image.service';
import { dockerConfig } from '@dofe/infra-common/dist/config/env-config.service';

// 子服务导入 - 直接导入避免循环依赖
import { DockerStatsService } from './docker-stats.service';
import {
  DockerOrphanCleanerService,
  SandboxOrphanInfo,
  SandboxCleanupReport,
} from './docker-orphan-cleaner.service';
import {
  convertToDockerHost,
  getDockerConnectionOptions,
  getApiKeyEnvName,
  getBaseUrlEnvName,
} from './docker.utils';

export interface ContainerInfo {
  id: string;
  state: string;
  running: boolean;
  exitCode: number;
  startedAt: string;
  finishedAt: string;
}

export interface CreateContainerOptions {
  hostname: string;
  /** Isolation key for multi-tenant support (userId_short-hostname) */
  isolationKey: string;
  name: string;
  port: number;
  gatewayToken: string;
  aiProvider: string;
  model: string;
  channelType: string;
  workspacePath: string;
  /** API key for the provider (will be passed as environment variable) - used in direct mode */
  apiKey?: string;
  /** Custom API base URL for the provider - used in direct mode */
  apiBaseUrl?: string;
  /** Proxy URL for zero-trust mode (e.g., http://keyring-proxy:8080) */
  proxyUrl?: string;
  /** Bot token for proxy authentication - used in zero-trust mode */
  proxyToken?: string;
  /** API type for the provider (openai, anthropic, gemini, etc.) */
  apiType?: string;
  /** User's preferred API protocol type (from ModelAvailability.preferredApiType) */
  preferredApiType?: 'openai' | 'anthropic' | 'gemini';
  /** Bot type - determines which Docker image to use (default: GATEWAY) */
  botType?: BotType;
  /** Pool mode - if true, skip openclaw.json generation (managed by GatewayGlobalConfigService) */
  poolMode?: boolean;
  /** Use external sandbox mode - Manager creates sandbox container instead of OpenClaw */
  useExternalSandbox?: boolean;
}

/** Options for creating a sandbox container */
export interface CreateSandboxOptions {
  /** Gateway key used for container naming */
  gatewayKey: string;
  /** Network mode to use (should match Gateway's network) */
  networkMode: string;
  /** Sandbox Docker image (optional, uses default if not specified) */
  sandboxImage?: string;
  /** CPU limit in cores (default: 0.5) */
  cpuLimit?: number;
  /** Memory limit in bytes (default: 1GB) */
  memoryLimit?: number;
}

@Injectable()
export class DockerService implements OnModuleInit {
  private docker: Docker;
  /** Bot images mapped by bot type */
  private readonly botImages: Record<BotType, string>;
  private readonly portStart: number;
  private readonly dataDir: string;
  private readonly secretsDir: string;
  private readonly openclawDir: string;
  private readonly containerPrefix = 'clawbot-manager-';
  /**
   * Docker volume names for bot data, secrets, and OpenClaw data.
   * When running in a container, we need to use volume names instead of host paths
   * to correctly mount volumes into bot containers.
   */
  private readonly dataVolumeName: string | null;
  private readonly secretsVolumeName: string | null;
  private readonly openclawVolumeName: string | null;
  /**
   * Container resource limits
   * Configured via GATEWAY_CONTAINER_CPU_LIMIT and GATEWAY_CONTAINER_MEMORY_LIMIT environment variables
   */
  private readonly containerCpuLimit: number;
  private readonly containerMemoryLimit: number;

  // 子服务实例（在 onModuleInit 中初始化）
  private statsService!: DockerStatsService;
  private orphanCleanerService!: DockerOrphanCleanerService;

  /**
   * Docker CLI path on the host system.
   * Detected at initialization to handle different platforms:
   * - macOS (Docker Desktop/OrbStack): /usr/local/bin/docker
   * - Linux: /usr/bin/docker
   */
  private readonly dockerCliPath: string;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly configService: ConfigService,
    private readonly dockerImageService: DockerImageService,
  ) {
    // Initialize bot images (only GATEWAY type is supported)
    this.botImages = {
      GATEWAY: dockerConfig.images.gateway,
    };
    this.logger.info(`Bot image configured: GATEWAY=${this.botImages.GATEWAY}`);

    // Container resource limits
    this.containerCpuLimit = dockerConfig.limits.cpu;
    this.containerMemoryLimit = dockerConfig.limits.memory;
    this.logger.info(
      `Container resource limits: CPU=${this.containerCpuLimit} cores, Memory=${(this.containerMemoryLimit / 1024 / 1024 / 1024).toFixed(1)}GB`,
    );

    // 端口配置
    this.portStart = dockerConfig.portStart;

    // 目录配置
    const dataDir = dockerConfig.directories.data;
    const secretsDir = dockerConfig.directories.secrets;
    const openclawDir = dockerConfig.directories.openclaw;

    // 统一规范为绝对路径，避免 Docker 把相对路径当作 volume 名称（从而报类似 "includes invalid characters"）
    this.dataDir = isAbsolute(dataDir) ? dataDir : join(process.cwd(), dataDir);
    this.secretsDir = isAbsolute(secretsDir)
      ? secretsDir
      : join(process.cwd(), secretsDir);
    this.openclawDir = isAbsolute(openclawDir)
      ? openclawDir
      : join(process.cwd(), openclawDir);

    // Volume names for containerized deployment
    this.dataVolumeName = dockerConfig.volumes.data || null;
    this.secretsVolumeName = dockerConfig.volumes.secrets || null;
    this.openclawVolumeName = dockerConfig.volumes.openclaw || null;

    // Detect Docker CLI path based on platform
    // macOS: /usr/local/bin/docker (Docker Desktop, OrbStack)
    // Linux: /usr/bin/docker
    this.dockerCliPath = this.detectDockerCliPath();
  }

  /**
   * Get the Docker image for a bot type
   */
  private getBotImage(botType: BotType): string {
    return this.botImages[botType] || this.botImages.GATEWAY;
  }

  /**
   * Detect Docker CLI path on the host system.
   * Handles different platforms:
   * - macOS (Docker Desktop/OrbStack): /usr/local/bin/docker
   * - Linux: /usr/bin/docker
   * - Windows: typically not used for container mounts
   *
   * Also resolves symlinks (OrbStack uses symlinks to app bundle).
   *
   * @returns The resolved Docker CLI path (real path, not symlink)
   */
  private detectDockerCliPath(): string {
    const fs = require('fs');
    const possiblePaths = [
      '/usr/local/bin/docker', // macOS (Docker Desktop, OrbStack)
      '/usr/bin/docker', // Linux
    ];

    // Try to find the Docker CLI by checking common paths
    for (const path of possiblePaths) {
      try {
        if (fs.existsSync(path)) {
          // Resolve symlink if it's a symbolic link
          // OrbStack on macOS uses a symlink to /Applications/OrbStack.app/...
          const resolvedPath = fs.realpathSync(path);
          this.logger.info(
            `Docker CLI detected: ${path} (resolved: ${resolvedPath})`,
          );
          return resolvedPath;
        }
      } catch {
        // Ignore errors, try next path
      }
    }

    // Fallback to /usr/bin/docker (Linux default)
    // This may fail on macOS but the error will be caught during container creation
    this.logger.warn(
      'Docker CLI not found at common paths, using fallback: /usr/bin/docker',
    );
    return '/usr/bin/docker';
  }

  async onModuleInit() {
    // 初始化为 null，避免后台 init 完成前被误用
    this.docker = null as unknown as Docker;

    const runInit = async () => {
      const startedAt = Date.now();
      try {
        const dockerHost = dockerConfig.dockerHost;
        this.docker = new Docker(getDockerConnectionOptions(dockerHost));

        const pingWithTimeout = (ms: number) =>
          Promise.race([
            this.docker.ping(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Docker ping timeout')), ms),
            ),
          ]);

        await pingWithTimeout(5000);
        // this.logger.info('Docker connection established', {
        //   dockerHost:
        //     dockerHost.startsWith('tcp') || dockerHost.startsWith('http')
        //       ? dockerHost
        //       : '(socket)',
        // });
      } catch (error) {
        this.logger.warn(
          'Docker not available, container operations will be simulated',
        );
        this.logger.warn('DockerService init fallback', {
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startedAt,
        });
        this.docker = null as unknown as Docker;
      }

      this.statsService = new DockerStatsService(this.docker);
      this.orphanCleanerService = new DockerOrphanCleanerService(
        this.docker,
        this.dataDir,
        this.secretsDir,
        this.containerPrefix,
        (level, _message) => {
          if (level === 'log') {
            this.logger.info(_message);
          } else if (level === 'warn') {
            this.logger.warn(_message);
          } else if (level === 'error') {
            this.logger.error(_message);
          }
        },
      );
    };

    this.logger.info('DockerService init scheduled in background');
    void runInit();
  }

  /**
   * Check if Docker is available
   */
  isAvailable(): boolean {
    return this.docker !== null;
  }

  /**
   * Build volume bindings for bot container.
   * When running in a container with named volumes (DATA_VOLUME_NAME/SECRETS_VOLUME_NAME/OPENCLAW_VOLUME_NAME set),
   * use volume names to allow bot containers to access the same data.
   * Otherwise, use host paths for local development.
   *
   * OpenClaw data directory (default: /home/node/.openclaw, overridable via OPENCLAW_HOME) is mounted to persist:
   * - Memory/sessions (conversation history)
   * - Agent configurations
   * - Identity data
   *
   * @param isolationKey - Isolation key for multi-tenant support (userId_short-hostname)
   * @param workspacePath - Full workspace path (used in host path mode)
   * @param useExternalSandbox - If true, skip docker.sock mount (Manager manages sandbox)
   * @returns Array of volume bind strings for Docker
   */
  private buildVolumeBinds(
    isolationKey: string,
    workspacePath: string,
    useExternalSandbox?: boolean,
  ): string[] {
    const binds: string[] = [];

    if (
      this.dataVolumeName &&
      this.secretsVolumeName &&
      this.openclawVolumeName
    ) {
      // Containerized mode: use named volumes with subdirectories
      // Format: volume_name/subpath:/container/path:mode
      // Note: Docker doesn't support subpaths in named volumes directly,
      // so we mount the entire volume and the bot uses isolationKey as subdirectory
      this.logger.info(
        `Using named volumes: data=${this.dataVolumeName}, secrets=${this.secretsVolumeName}, openclaw=${this.openclawVolumeName}`,
      );
      binds.push(
        `${this.dataVolumeName}:/data/bots:rw`,
        `${this.secretsVolumeName}:/data/secrets:ro`,
        // Mount OpenClaw data directory for persistent memory/sessions
        // The bot will use /data/openclaw/{isolationKey} as its .openclaw directory
        `${this.openclawVolumeName}:/data/openclaw:rw`,
      );
      // Mount docker.sock for OpenClaw sandbox container creation
      // This allows OpenClaw to create isolated browser sandbox containers
      // Skip if using external sandbox mode (Manager manages sandbox containers)
      if (!useExternalSandbox) {
        binds.push('/var/run/docker.sock:/var/run/docker.sock:rw');
        // Mount docker CLI for OpenClaw to create sandbox containers
        // The openclaw image doesn't include docker CLI, so we mount it from host
        // Use detected path (macOS: /usr/local/bin/docker, Linux: /usr/bin/docker)
        binds.push(`${this.dockerCliPath}:/usr/bin/docker:ro`);
      }
    } else {
      // Local development mode: use host paths
      // If workspacePath is empty, use isolationKey to build a default path
      const effectiveWorkspacePath =
        workspacePath || join(this.dataDir, isolationKey);
      this.logger.info(
        `Using host paths: data=${effectiveWorkspacePath}, openclaw=${this.openclawDir}/${isolationKey}`,
      );
      binds.push(
        `${effectiveWorkspacePath}:/app/workspace:rw`,
        `${this.secretsDir}/${isolationKey}:/app/secrets:ro`,
        // Mount OpenClaw data directory for persistent memory/sessions
        `${this.openclawDir}/${isolationKey}:/home/node/.openclaw:rw`,
      );
      // Mount docker.sock for OpenClaw sandbox container creation
      // This allows OpenClaw to create isolated browser sandbox containers
      // Skip if using external sandbox mode (Manager manages sandbox containers)
      if (!useExternalSandbox) {
        binds.push('/var/run/docker.sock:/var/run/docker.sock:rw');
        // Mount docker CLI for OpenClaw to create sandbox containers
        // The openclaw image doesn't include docker CLI, so we mount it from host
        // Use detected path (macOS: /usr/local/bin/docker, Linux: /usr/bin/docker)
        binds.push(`${this.dockerCliPath}:/usr/bin/docker:ro`);
      }
    }
    return binds;
  }

  /**
   * Create and start a container for a bot
   */
  async createContainer(options: CreateContainerOptions): Promise<string> {
    if (!this.isAvailable()) {
      this.logger.warn('Docker not available, simulating container creation');
      return `simulated-${options.isolationKey}`;
    }

    // Use isolationKey for container name to ensure uniqueness across users
    const containerName = `${this.containerPrefix}${options.isolationKey}`;

    // Check if container already exists
    try {
      const existing = this.docker.getContainer(containerName);
      const info = await existing.inspect();
      if (info) {
        this.logger.info(
          `Container ${containerName} already exists, removing...`,
        );
        await existing.remove({ force: true });
      }
    } catch {
      // Container doesn't exist, which is expected
    }

    // Get bot type with default
    const botType = options.botType || 'GATEWAY';
    const botImage = this.getBotImage(botType);
    this.logger.info(
      `Creating container for bot type: ${botType}, image: ${botImage}`,
    );

    // Pull image if not exists
    await this.pullImageIfNeeded(botImage);

    // Build environment variables
    // Normalize model name to handle aliases like chatgpt-4o-latest -> gpt-4o
    // Use apiType for normalization when provider differs from apiType
    const normalizationProvider =
      options.apiType && options.aiProvider !== options.apiType
        ? options.apiType
        : options.aiProvider;
    const normalizedModel = normalizeModelName(
      options.model,
      normalizationProvider,
    );
    if (normalizedModel !== options.model) {
      this.logger.info(
        `Normalized model name: ${options.model} -> ${normalizedModel} (using provider: ${normalizationProvider})`,
      );
    }

    // 根据 apiType 确定 Docker 容器内的 provider 标识
    // OpenClaw 原生支持的 vendor（如 zhipu、deepseek）不需要映射为 -compatible
    // 只有非原生支持的 vendor 才需要映射：
    //   - apiType=openai, vendor=openai → "openai"
    //   - apiType=openai, vendor=dashscope/非原生... → "openai-compatible"
    // 同时确保 base URL 和 API key 使用 apiType 对应的环境变量名
    const originalProvider = options.aiProvider;
    const originalProviderConfig =
      PROVIDER_CONFIGS[originalProvider as ProviderVendor];

    // 检查是否为 OpenClaw 原生支持的 vendor
    const nativeProviderConfig = getOpenclawNativeProvider(originalProvider);
    const isOpenclawNative = nativeProviderConfig !== null;

    if (nativeProviderConfig !== null) {
      this.logger.info(
        `Provider "${originalProvider}" is natively supported by OpenClaw (providerId: ${nativeProviderConfig.openclawProviderId}), skipping -compatible mapping`,
      );
    }

    // 只有非原生支持且 apiType 不同时才映射为 -compatible
    if (
      !isOpenclawNative &&
      options.apiType &&
      options.aiProvider !== 'custom' &&
      options.aiProvider !== options.apiType &&
      !options.apiType.startsWith(options.aiProvider)
    ) {
      // 保留原始 apiHost 作为 apiBaseUrl 的 fallback
      if (!options.apiBaseUrl && originalProviderConfig?.apiHost) {
        options.apiBaseUrl = originalProviderConfig.apiHost as string;
      }
      const dockerProvider = `${options.apiType}-compatible`;
      this.logger.info(
        `Mapping non-native provider "${options.aiProvider}" to "${dockerProvider}" for OpenClaw (apiType: ${options.apiType})`,
      );
      options.aiProvider = dockerProvider;
    }

    // Base environment variables (always set)
    const envVars = [
      `BOT_HOSTNAME=${options.hostname}`,
      `BOT_NAME=${options.name}`,
      `BOT_PORT=${options.port}`,
      `OPENCLAW_GATEWAY_TOKEN=${options.gatewayToken}`,
      `CHANNEL_TYPE=${options.channelType}`,
      // Pool mode flag - if true, skip openclaw.json generation in startup script
      `POOL_MODE=${options.poolMode ? 'true' : 'false'}`,
      // Playwright remote browser configuration
      `PLAYWRIGHT_BROWSERS_PATH=/home/node/.cache/ms-playwright`,
      `PLAYWRIGHT_REMOTE_CONNECT_TIMEOUT=60000`,
      // npm registry for China network (optional)
      ...(dockerConfig.npmRegistry
        ? [`NPM_CONFIG_REGISTRY=${dockerConfig.npmRegistry}`]
        : []),
      // Python ecosystem defaults for persistent workspace-based installs
      'PIP_DISABLE_PIP_VERSION_CHECK=1',
      'PIP_ROOT_USER_ACTION=ignore',
      'UV_LINK_MODE=copy',
    ];

    // In zero-trust mode, do NOT set AI_PROVIDER, AI_MODEL, AI_VENDOR
    // because these would cause the startup script to generate configuration
    // that overwrites the preloaded proxy-* provider configuration.
    // The preloaded config (generated by GatewayConfigPreloadService) is the
    // single source of truth for zero-trust mode.
    const isZeroTrustMode = !!(options.proxyUrl && options.proxyToken);
    if (!isZeroTrustMode) {
      // Direct mode: Set provider/model environment variables for startup script
      envVars.push(`AI_PROVIDER=${options.aiProvider}`);
      envVars.push(`AI_MODEL=${normalizedModel}`);
      // Original vendor name before mapping (e.g., "zhipu", "dashscope", "openai")
      // Used to determine API protocol in entrypoint
      envVars.push(`AI_VENDOR=${originalProvider}`);
    }

    // When using named volumes, bot needs to know its workspace subdirectory
    // This must match the condition in buildVolumeBinds
    const useNamedVolumes =
      this.dataVolumeName && this.secretsVolumeName && this.openclawVolumeName;
    if (useNamedVolumes) {
      envVars.push(`BOT_WORKSPACE_DIR=/data/bots/${options.isolationKey}`);
      envVars.push(`BOT_SECRETS_DIR=/data/secrets/${options.isolationKey}`);
      // OpenClaw data directory for persistent memory/sessions
      envVars.push(`OPENCLAW_HOME=/data/openclaw/${options.isolationKey}`);
    } else {
      envVars.push(`BOT_WORKSPACE_DIR=/app/workspace`);
      envVars.push(`BOT_SECRETS_DIR=/app/secrets`);
      // 本地开发模式：openclaw 目录挂载到 /home/node/.openclaw，
      // OpenClaw 会在 $OPENCLAW_HOME/.openclaw/ 下读写配置，
      // 所以需要设置为 /home/node（父目录），使其解析为 /home/node/.openclaw/
      envVars.push(`OPENCLAW_HOME=/home/node`);
    }

    // Add API type if provided
    if (options.apiType) {
      envVars.push(`AI_API_TYPE=${options.apiType}`);
    }

    // Add preferred API type if provided
    // This tells the container's entrypoint script which protocol the user explicitly selected
    if (options.preferredApiType) {
      envVars.push(`PREFERRED_API_TYPE=${options.preferredApiType}`);
    }

    // Get provider config for environment variable naming
    const providerConfig =
      PROVIDER_CONFIGS[options.aiProvider as ProviderVendor];

    // Zero-trust mode: Use proxy URL and token instead of direct API key
    if (options.proxyUrl && options.proxyToken) {
      // Pass proxy configuration to container (convert localhost to host.docker.internal)
      const dockerProxyUrl = convertToDockerHost(options.proxyUrl);
      envVars.push(`PROXY_URL=${dockerProxyUrl}`);
      envVars.push(`PROXY_TOKEN=${options.proxyToken}`);

      // Subagents may resolve the effective provider back to a built-in vendor
      // (for example: anthropic) before the proxy-* config has fully loaded.
      // Export provider-specific fallback auth/baseUrl vars that still point to the proxy
      // so requests continue to stay inside the zero-trust path instead of failing early.
      //
      // IMPORTANT: Inject ALL major protocol fallback vars, not just one based on apiType.
      // This ensures subagents can find auth regardless of which protocol they resolve to.
      envVars.push(`ANTHROPIC_API_KEY=${options.proxyToken}`);
      envVars.push(`ANTHROPIC_BASE_URL=${dockerProxyUrl}/v1/anthropic`);
      envVars.push(`OPENAI_API_KEY=${options.proxyToken}`);
      envVars.push(`OPENAI_BASE_URL=${dockerProxyUrl}/v1/openai-compatible`);
      envVars.push(`GOOGLE_API_KEY=${options.proxyToken}`);
      envVars.push(`GOOGLE_BASE_URL=${dockerProxyUrl}/v1/gemini-compatible`);

      this.logger.info(
        `Container ${options.hostname} configured in zero-trust mode with proxy: ${dockerProxyUrl}`,
      );
    } else {
      // Direct mode: Pass API key and base URL directly
      const useApiType =
        options.apiType &&
        options.aiProvider !== options.apiType &&
        !options.apiType.startsWith(options.aiProvider);

      if (options.apiKey) {
        // Always set the provider-specific API key (e.g., DOUBAO_API_KEY)
        const providerEnvKeyName = getApiKeyEnvName(options.aiProvider);
        envVars.push(`${providerEnvKeyName}=${options.apiKey}`);

        // Also set apiType-specific key if different (e.g., OPENAI_API_KEY for openai api type)
        if (useApiType) {
          const apiTypeEnvKeyName = getApiKeyEnvName(options.apiType!);
          envVars.push(`${apiTypeEnvKeyName}=${options.apiKey}`);
        }
      }

      // Add custom base URL if provided (convert localhost to host.docker.internal)
      if (options.apiBaseUrl) {
        const dockerBaseUrl = convertToDockerHost(options.apiBaseUrl);
        const providerBaseUrlName = getBaseUrlEnvName(options.aiProvider);
        envVars.push(`${providerBaseUrlName}=${dockerBaseUrl}`);
        if (useApiType) {
          const apiTypeBaseUrlName = getBaseUrlEnvName(options.apiType!);
          envVars.push(`${apiTypeBaseUrlName}=${dockerBaseUrl}`);
        }
      } else if (providerConfig?.apiHost) {
        // Use default API host from provider config if no custom URL
        const baseUrlEnvName = useApiType
          ? getBaseUrlEnvName(options.apiType!)
          : getBaseUrlEnvName(options.aiProvider);
        envVars.push(`${baseUrlEnvName}=${providerConfig.apiHost}`);
      }

      this.logger.info(
        `Container ${options.hostname} configured in direct mode`,
      );
    }

    // Determine network mode:
    // - In zero-trust mode, connect to common_network to reach keyring-proxy
    // - In direct mode, use bridge network
    const networkMode = options.proxyUrl ? 'common_network' : 'bridge';

    // Build volume bindings
    // When running in a container with named volumes, use volume names instead of host paths
    // This allows bot containers to access the same data volumes as the manager container
    const binds = this.buildVolumeBinds(
      options.isolationKey,
      options.workspacePath,
      options.useExternalSandbox,
    );

    // Build HostConfig with bot type specific settings
    const hostConfig: Docker.HostConfig = {
      PortBindings: {
        [`${options.port}/tcp`]: [{ HostPort: String(options.port) }],
        ['9205/tcp']: [{ HostPort: '9205' }],
      },
      Binds: binds,
      RestartPolicy: { Name: 'unless-stopped' },
      NetworkMode: networkMode,
      // On Linux, host.docker.internal is not resolved automatically.
      // Explicitly inject it via host-gateway so containers can reach the host.
      ExtraHosts: ['host.docker.internal:host-gateway'],
      // Resource limits to prevent single bot from consuming too many resources
      // CpuQuota: 100000 = 1 CPU (microseconds per 100ms period)
      CpuQuota: this.containerCpuLimit * 100000,
      // Memory limit in bytes
      Memory: this.containerMemoryLimit,
      // MemorySwap = Memory means no swap usage
      MemorySwap: this.containerMemoryLimit,
    };

    const container = await this.docker.createContainer({
      name: containerName,
      Image: botImage,
      // Override healthcheck to use dynamic port (image default uses 18789)
      // Health check endpoint is provided by OpenClaw Gateway on the WebSocket port
      Healthcheck: {
        Test: [
          'CMD-SHELL',
          `node -e "fetch('http://127.0.0.1:${options.port}/healthz').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"`,
        ],
        Interval: 180000000000, // 3 minutes in nanoseconds
        Timeout: 10000000000, // 10 seconds in nanoseconds
        StartPeriod: 15000000000, // 15 seconds in nanoseconds
        Retries: 3,
      },
      // Run as root to fix workspace permissions, then drop to node user for gateway
      User: 'root',
      // Start OpenClaw gateway with proper configuration
      // Use shell to configure OpenClaw before starting the gateway:
      // 1. Set the model if AI_MODEL is provided
      // 2. Add API key to auth-profiles.json if provided via environment variable
      // 3. Start the gateway (as node user for security)
      Entrypoint: ['/bin/sh', '-c'],
      Cmd: [
        `
        # ============================================================
        # DOCKER SOCKET PERMISSION FIX (RUN FIRST)
        # This ensures node user can access Docker socket for Sandbox operations
        # Must run before any other operations that might need Docker access
        # ============================================================
        echo "=== Fixing Docker socket permissions ==="
        # Create docker group with host's GID (typically 1001)
        # This matches the group ownership of /var/run/docker.sock on the host
        groupadd -g 1001 docker 2>/dev/null || echo "docker group exists"
        # Add node user to docker group
        usermod -aG docker node 2>/dev/null || echo "node already in docker group"
        echo "node user groups: $(id node)"
        echo "=========================================="

        # ============================================================
        # /data DIRECTORY SETUP (RUN SECOND)
        # OpenClaw Sandbox needs /data directory for operations
        # Must run as root before dropping to node user
        # ============================================================
        echo "=== Creating /data directory for Sandbox ==="
        mkdir -p /data
        chown node:node /data
        chmod 755 /data
        echo "/data directory created and owned by node"
        ls -la /data
        echo "=========================================="

        # ============================================================
        # DEBUG: Provider Configuration (for troubleshooting)
        # ============================================================
        echo "=== Provider Configuration ==="
        echo "AI_PROVIDER=$AI_PROVIDER"
        echo "AI_API_TYPE=$AI_API_TYPE"
        echo "AI_VENDOR=$AI_VENDOR"
        echo "AI_MODEL=$AI_MODEL"
        echo "=============================="

        # IMPORTANT: OpenClaw's OpenAI SDK reads OPENAI_BASE_URL at initialization time
        # We use the standard 'openai' provider (not 'openai-compatible') because:
        # 1. OpenAI SDK automatically reads OPENAI_BASE_URL environment variable
        # 2. The 'openai-compatible' provider has known integration gaps (GitHub Issue #9498)
        # 3. Using standard provider ensures SDK uses our custom base URL

        # Determine the provider for auth configuration and model prefix
        PROVIDER="${options.aiProvider}"
        if [ "$PROVIDER" = "custom" ] && [ -n "$AI_API_TYPE" ]; then
          # For custom provider, use AI_API_TYPE for auth and model prefix
          AUTH_PROVIDER="$AI_API_TYPE"
          MODEL_PROVIDER="$AI_API_TYPE"
        elif echo "$PROVIDER" | grep -q -- "-compatible$"; then
          # For *-compatible providers (e.g., openai-compatible):
          # Use the BASE provider name (e.g., "openai") as MODEL_PROVIDER
          # This ensures OpenClaw uses its built-in provider which reads
          # API keys from standard environment variables (OPENAI_API_KEY, etc.)
          # The proxy URL still contains "-compatible" for auto-routing
          AUTH_PROVIDER=$(echo "$PROVIDER" | sed 's/-compatible$//')
          MODEL_PROVIDER="$AUTH_PROVIDER"
        else
          AUTH_PROVIDER="$PROVIDER"
          MODEL_PROVIDER="$PROVIDER"
        fi

        # Set the model if AI_MODEL is provided
        # OpenClaw expects model format: provider/model-name
        if [ -n "$AI_MODEL" ]; then
          # Check if model already has a provider prefix (contains /)
          if echo "$AI_MODEL" | grep -q "/"; then
            # Model has provider prefix, extract it and validate
            MODEL_PREFIX=$(echo "$AI_MODEL" | cut -d'/' -f1)
            MODEL_NAME=$(echo "$AI_MODEL" | cut -d'/' -f2-)
            echo "Model has provider prefix: $MODEL_PREFIX, model name: $MODEL_NAME"

            # If prefix doesn't match MODEL_PROVIDER, fix it
            if [ "$MODEL_PREFIX" != "$MODEL_PROVIDER" ]; then
              echo "Warning: Model prefix '$MODEL_PREFIX' doesn't match provider '$MODEL_PROVIDER'"
              echo "Storing model prefix for auth-profiles.json: $MODEL_PREFIX"
              # Keep the original prefix for auth-profiles.json
              FULL_MODEL="$AI_MODEL"
            else
              FULL_MODEL="$AI_MODEL"
            fi
          else
            # Add provider prefix for OpenClaw (use MODEL_PROVIDER for correct prefix)
            FULL_MODEL="$MODEL_PROVIDER/$AI_MODEL"
          fi
          echo "Setting model to: $FULL_MODEL"
          # Note: Model is set directly in openclaw.json below, no CLI command needed
          # CLI commands like 'models set' start background services that can hang
        fi

        # Configure API key based on provider
        # In zero-trust mode, use PROXY_TOKEN as the API key
        # Otherwise, check for provider-specific API key environment variables
        export API_KEY=""
        if [ -n "$PROXY_TOKEN" ]; then
          # Zero-trust mode: use proxy token as API key
          export API_KEY="$PROXY_TOKEN"
          echo "Using proxy token for authentication"
        else
          # Direct mode: use provider-specific API key
          case "$AUTH_PROVIDER" in
            openai) export API_KEY="$OPENAI_API_KEY" ;;
            anthropic) export API_KEY="$ANTHROPIC_API_KEY" ;;
            google) export API_KEY="$GOOGLE_API_KEY" ;;
            groq) export API_KEY="$GROQ_API_KEY" ;;
            mistral) export API_KEY="$MISTRAL_API_KEY" ;;
            deepseek) export API_KEY="$DEEPSEEK_API_KEY" ;;
            zhipu) export API_KEY="$ZHIPU_API_KEY" ;;
            moonshot) export API_KEY="$MOONSHOT_API_KEY" ;;
            dashscope) export API_KEY="$DASHSCOPE_API_KEY" ;;
            doubao) export API_KEY="$DOUBAO_API_KEY" ;;
            silicon) export API_KEY="$SILICONFLOW_API_KEY" ;;
            custom) export API_KEY="$CUSTOM_API_KEY" ;;
            *) export API_KEY="" ;;
          esac
        fi

        # Export API key as environment variable for OpenClaw
        # OpenClaw reads API keys from standard environment variables
        if [ -n "$API_KEY" ]; then
          case "$AUTH_PROVIDER" in
            openai) export OPENAI_API_KEY="$API_KEY" ;;
            anthropic) export ANTHROPIC_API_KEY="$API_KEY" ;;
            google) export GOOGLE_API_KEY="$API_KEY" ;;
            groq) export GROQ_API_KEY="$API_KEY" ;;
            mistral) export MISTRAL_API_KEY="$API_KEY" ;;
            deepseek) export DEEPSEEK_API_KEY="$API_KEY" ;;
            *) export OPENAI_API_KEY="$API_KEY" ;;
          esac
          echo "Configured API key for provider: $AUTH_PROVIDER"
        fi

        # In proxy mode, always export OPENAI_API_KEY as generic auth key for OpenClaw
        if [ -n "$PROXY_TOKEN" ]; then
          export OPENAI_API_KEY="$PROXY_TOKEN"
        fi
        
        # In proxy mode, derive OPENAI_BASE_URL from PROXY_URL + protocol endpoint.
        # This configures the startup provider with the correct proxy baseUrl so that
        # OpenClaw can route LLM calls via the proxy before initGlobalConfig runs (~30s).
        # Endpoint mapping must match PROVIDER_MAP in gateway-global-config.service.ts:
        #   anthropic → /v1/anthropic-compatible
        #   gemini    → /v1/gemini-compatible
        #   *         → /v1/openai-compatible
        if [ -n "$PROXY_TOKEN" ] && [ -n "$PROXY_URL" ]; then
          case "$AUTH_PROVIDER" in
            anthropic) export OPENAI_BASE_URL="$PROXY_URL/v1/anthropic-compatible" ;;
            gemini)    export OPENAI_BASE_URL="$PROXY_URL/v1/gemini-compatible" ;;
            *)         export OPENAI_BASE_URL="$PROXY_URL/v1/openai-compatible" ;;
          esac
          echo "Proxy mode: OPENAI_BASE_URL=$OPENAI_BASE_URL (provider: $AUTH_PROVIDER)"
        fi

        # Export base URL for OpenClaw when using custom provider
        # OpenClaw expects provider-specific base URL env vars (e.g., OPENAI_BASE_URL)
        # Map CUSTOM_BASE_URL to the appropriate provider-specific env var
        if [ "$PROVIDER" = "custom" ] && [ -n "$CUSTOM_BASE_URL" ]; then
          case "$AUTH_PROVIDER" in
            openai) export OPENAI_BASE_URL="$CUSTOM_BASE_URL" ;;
            anthropic) export ANTHROPIC_BASE_URL="$CUSTOM_BASE_URL" ;;
            *) export OPENAI_BASE_URL="$CUSTOM_BASE_URL" ;;
          esac
          echo "Mapped CUSTOM_BASE_URL to provider base URL: $CUSTOM_BASE_URL"
        fi

        # Create workspace directory if it doesn't exist
        # This is needed because the volume might be mounted with root ownership
        echo "Creating workspace directory: $BOT_WORKSPACE_DIR"
        if ! mkdir -p "$BOT_WORKSPACE_DIR" 2>/dev/null; then
          echo "ERROR: Cannot create workspace directory $BOT_WORKSPACE_DIR"
          echo "This is likely a permission issue with the mounted volume."
          echo "Please ensure the /data/bots volume has proper permissions for the node user."
          echo "You can fix this by running: docker exec -u root <manager-container> chown -R node:node /data/bots"
          exit 1
        fi
        echo "Workspace directory created successfully"

        # Fix workspace directory permissions for node user
        # Now running as root, so chown will succeed
        echo "Setting workspace ownership to node:node: $BOT_WORKSPACE_DIR"
        chown -R node:node "$BOT_WORKSPACE_DIR" || echo "Warning: chown failed"
        chmod 755 "$BOT_WORKSPACE_DIR" || echo "Warning: chmod failed"

        # Pool Mode Check: Skip full openclaw.json generation for Pool Gateway
        # In Pool mode, runtime configuration is managed by GatewayGlobalConfigService,
        # but OpenClaw still requires a minimal bootstrap config to start on non-loopback bind.
        # Pool Mode Check: Skip full openclaw.json generation for Pool Gateway
        # In Pool mode, runtime configuration is managed by GatewayGlobalConfigService,
        # but OpenClaw still requires a minimal bootstrap config to start on non-loopback bind.
        if [ "$POOL_MODE" = "true" ]; then
          echo "=========================================="
          echo "Pool Mode Detected"
          echo "=========================================="
          echo "Skipping full full openclaw.json generation"
          echo "Configuration will be managed by GatewayGlobalConfigService"
          echo "Creating minimal bootstrap config..."
          echo "Creating minimal bootstrap config..."

          CONFIG_DIR="\${OPENCLAW_HOME:-/home/node/.openclaw}"
          JSON_CONFIG_FILE="$CONFIG_DIR/openclaw.json"
          CONFIG_DIR="\${OPENCLAW_HOME:-/home/node/.openclaw}"
          JSON_CONFIG_FILE="$CONFIG_DIR/openclaw.json"
          mkdir -p "$CONFIG_DIR"
          # 创建 OpenClaw 需要的完整目录结构
          mkdir -p "$CONFIG_DIR/agents/main/sessions"
          mkdir -p "$CONFIG_DIR/agents/main/agent"
          # 确保所有子目录都有正确的权限
          chown -R node:node "$CONFIG_DIR"
          chmod -R 755 "$CONFIG_DIR"

          if [ -s "$JSON_CONFIG_FILE" ]; then
            echo "Existing openclaw.json detected, preserving current config"
            echo "Current openclaw.json:"
            cat "$JSON_CONFIG_FILE"
          else
            cat > "$JSON_CONFIG_FILE" << JSON_EOF
{
  "gateway": {
    "mode": "local",
    "port": $BOT_PORT,
    "bind": "lan",
    "auth": {
      "mode": "token",
      "token": "$OPENCLAW_GATEWAY_TOKEN"
    },
    "controlUi": {
      "enabled": true,
      "allowInsecureAuth": true,
      "dangerouslyAllowHostHeaderOriginFallback": true,
      "allowedOrigins": ["*"]
    }
  },
  "agents": {
    "defaults": {
      "workspace": "$BOT_WORKSPACE_DIR"
    }
  },
  "skills": {
    "load": {
      "watch": true
    }
  }
}
JSON_EOF

            chown node:node "$JSON_CONFIG_FILE"

            echo "Created bootstrap openclaw.json:"
            cat "$JSON_CONFIG_FILE"

            # CRITICAL: Create OpenClaw internal config for controlUi settings
            INTERNAL_CONFIG_DIR="$CONFIG_DIR/.openclaw"
            INTERNAL_CONFIG_FILE="$INTERNAL_CONFIG_DIR/openclaw.json"
            mkdir -p "$INTERNAL_CONFIG_DIR"
            cat > "$INTERNAL_CONFIG_FILE" << INTERNAL_EOF
{
  "gateway": {
    "controlUi": {
      "dangerouslyAllowHostHeaderOriginFallback": true
    }
  },
  "meta": {
    "lastTouchedVersion": "2026.3.28"
  }
}
INTERNAL_EOF
            chown -R node:node "$INTERNAL_CONFIG_DIR"
            echo "Created internal OpenClaw config at $INTERNAL_CONFIG_FILE"
          fi
          echo "Starting OpenClaw Gateway in Pool mode..."
          echo "Port: $BOT_PORT"
          echo "=========================================="

          # Start OpenClaw with bootstrap config; full config will be applied later by preload/global-config services
          if [ "$(id -u)" = "0" ]; then
            echo "Starting gateway as node user..."
            exec su -s /bin/sh -c "exec node /app/openclaw.mjs gateway --allow-unconfigured --port $BOT_PORT --bind lan" node
          else
            exec node /app/openclaw.mjs gateway --allow-unconfigured --port $BOT_PORT --bind lan
          fi
        fi

        # Single Bot Mode: Generate openclaw.json configuration
        # Create openclaw.json configuration with gateway token authentication
        # This is required for WebSocket connections to the Gateway
        CONFIG_DIR="\${OPENCLAW_HOME:-/home/node/.openclaw}"
        JSON_CONFIG_FILE="$CONFIG_DIR/openclaw.json"
        mkdir -p "$CONFIG_DIR"
        # 创建 OpenClaw 需要的 sessions 目录
        mkdir -p "$CONFIG_DIR/agents/main/sessions"

        # Preserve channels from the existing openclaw.json BEFORE overwriting it.
        # On SIGUSR1 process restarts the config is rewritten fresh (no channels).
        # Capturing here and restoring below prevents the channels-restart boot loop:
        #   round 1: channels written by syncChannelsIfChanged → unavoidable restart
        #   round 2: channels preserved here → startup includes them → diff=0 → no restart
        _OC_PRESERVE_CH="/tmp/oc-ch-preserve-$$.json"
        if [ -f "$JSON_CONFIG_FILE" ]; then
          node -e "
            try {
              const c = JSON.parse(require('fs').readFileSync('$JSON_CONFIG_FILE', 'utf8'));
              if (c.channels && Object.keys(c.channels).length > 0) {
                require('fs').writeFileSync('$_OC_PRESERVE_CH', JSON.stringify(c.channels));
              }
            } catch(e) {}
          " 2>/dev/null || true
          [ -f "$_OC_PRESERVE_CH" ] && echo "Channels captured for preservation"
        fi

        # Build openclaw.json - simple configuration
        # IMPORTANT: We rely on OPENAI_BASE_URL and OPENAI_API_KEY environment variables
        # for the OpenAI SDK to use our custom endpoint. The SDK reads these at initialization.
        echo "Creating openclaw.json with gateway token authentication..."

        # CRITICAL: Create OpenClaw internal config directory and file
        # OpenClaw reads controlUi.dangerouslyAllowHostHeaderOriginFallback from this internal config
        INTERNAL_CONFIG_DIR="$CONFIG_DIR/.openclaw"
        INTERNAL_CONFIG_FILE="$INTERNAL_CONFIG_DIR/openclaw.json"
        mkdir -p "$INTERNAL_CONFIG_DIR"
        cat > "$INTERNAL_CONFIG_FILE" << INTERNAL_EOF
{
  "gateway": {
    "controlUi": {
      "dangerouslyAllowHostHeaderOriginFallback": true
    }
  },
  "meta": {
    "lastTouchedVersion": "2026.3.28"
  }
}
INTERNAL_EOF
        chown -R node:node "$INTERNAL_CONFIG_DIR"
        echo "Created internal OpenClaw config at $INTERNAL_CONFIG_FILE"

        cat > "$JSON_CONFIG_FILE" << JSON_EOF
{
  "gateway": {
    "mode": "local",
    "port": $BOT_PORT,
    "bind": "lan",
    "auth": {
      "mode": "token",
      "token": "$OPENCLAW_GATEWAY_TOKEN"
    },
    "controlUi": {
      "enabled": true,
      "allowInsecureAuth": true,
      "dangerouslyAllowHostHeaderOriginFallback": true,
      "allowedOrigins": ["*"]
    }
  },
  "browser": {
    "enabled": true,
    "defaultProfile": "openclaw",
    "headless": false,
    "noSandbox": true,
    "profiles": {
      "openclaw": { "cdpPort": 18800, "color": "#FF4500" }
    }
  },
  "agents": {
    "defaults": {
      "workspace": "$BOT_WORKSPACE_DIR",
      "model": "$FULL_MODEL",
      "sandbox": {
        "mode": "all",
        "scope": "session",
        "backend": "docker",
        "docker": {
          "setupCommand": "apt-get update -qq && apt-get install -y -qq fonts-noto-cjk fonts-wqy-zenhei fonts-wqy-microhei 2>/dev/null || true"
        },
        "browser": {
          "autoStart": true
        }
      }
    }
  },
  "tools": {
    "sandbox": {
      "tools": {
        "allow": ["browser"]
      }
    }
  },
  "skills": {
    "load": {
      "watch": true,
      "debounce": 250
    },
    "registry": {
      "enabled": true
    }
  }
}
JSON_EOF
        echo "Created openclaw.json:"
        cat "$JSON_CONFIG_FILE"

        # Prepare auth-profiles directory
        export AUTH_PROFILES_DIR="$CONFIG_DIR/agents/main/agent"
        mkdir -p "$AUTH_PROFILES_DIR"
        export AUTH_PROFILES_FILE="$AUTH_PROFILES_DIR/auth-profiles.json"
        export ROOT_AUTH_FILE="$CONFIG_DIR/auth-profiles.json"

        # Note: Skipping 'doctor --fix' CLI command as it starts background services
        # Config is written directly above with all necessary settings

        # Additional cleanup: remove keys that OpenClaw may have added but doesn't recognize
        # These keys cause "Invalid config" errors and prevent config reload
        # Note: sandbox config is now supported and should NOT be removed
        echo "Removing unsupported config keys (meta.protocol)..."
        node -e "
          const fs = require('fs');
          const configPath = '$JSON_CONFIG_FILE';
          try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            let modified = false;
            if (config.meta && config.meta.protocol) {
              delete config.meta.protocol;
              modified = true;
            }
            if (modified) {
              fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
              process.stdout.write('Cleaned unsupported config keys\n');
            }
          } catch (e) {
            process.stderr.write('Failed to clean config: ' + e.message + '\n');
          }
        " 2>/dev/null || true

        # CRITICAL: Configure the base URL AFTER doctor --fix
        # doctor --fix overwrites our configuration, so we must set it again
        # Use MODEL_PROVIDER (base provider name) for config key
        #
        # Determine the API protocol for OpenClaw provider config:
        # Priority:
        #   1. PREFERRED_API_TYPE (user's explicit choice from ModelAvailability.preferredApiType)
        #   2. Derived from AI_API_TYPE + AI_VENDOR (fallback for legacy behavior)
        #
        # Protocol mapping:
        #   - PREFERRED_API_TYPE=anthropic → "anthropic-messages" (Anthropic Messages API)
        #   - PREFERRED_API_TYPE=gemini → "gemini" (Gemini native API)
        #   - AI_API_TYPE=openai AND AI_VENDOR!=openai → "openai-completions" (Chat Completions)
        #   - Otherwise → leave default
        #
        # See: https://docs.bigmodel.cn/cn/coding-plan/tool/openclaw
        OPENCLAW_API_PROTOCOL=""
        if [ -n "$PREFERRED_API_TYPE" ]; then
          # User explicitly selected a protocol type (from ModelAvailability.preferredApiType)
          if [ "$PREFERRED_API_TYPE" = "anthropic" ]; then
            OPENCLAW_API_PROTOCOL="anthropic-messages"
            echo "Using user-preferred protocol: anthropic-messages (PREFERRED_API_TYPE=$PREFERRED_API_TYPE)"
          elif [ "$PREFERRED_API_TYPE" = "gemini" ]; then
            OPENCLAW_API_PROTOCOL="gemini"
            echo "Using user-preferred protocol: gemini (PREFERRED_API_TYPE=$PREFERRED_API_TYPE)"
          elif [ "$PREFERRED_API_TYPE" = "openai" ] && [ "$AI_VENDOR" != "openai" ]; then
            OPENCLAW_API_PROTOCOL="openai-completions"
            echo "Using user-preferred protocol: openai-completions (PREFERRED_API_TYPE=$PREFERRED_API_TYPE)"
          fi
        elif [ "$AI_API_TYPE" = "openai" ] && [ "$AI_VENDOR" != "openai" ]; then
          # Fallback: derive from apiType and vendor
          OPENCLAW_API_PROTOCOL="openai-completions"
        elif [ "$AI_API_TYPE" = "anthropic" ]; then
          OPENCLAW_API_PROTOCOL="anthropic-messages"
        elif [ "$AI_API_TYPE" = "gemini" ]; then
          OPENCLAW_API_PROTOCOL="gemini"
        fi

        # Configure npm registry for China network (optional)
        # NPM_CONFIG_REGISTRY env var will be passed by the manager
        if [ -n "$NPM_CONFIG_REGISTRY" ]; then
          npm config set registry "$NPM_CONFIG_REGISTRY"
          echo "npm registry configured: $NPM_CONFIG_REGISTRY"
        fi

        # Prepare persistent Python tooling in workspace
        if [ -n "$BOT_WORKSPACE_DIR" ]; then
          mkdir -p "$BOT_WORKSPACE_DIR/.cache/pip" "$BOT_WORKSPACE_DIR/.cache/uv" "$BOT_WORKSPACE_DIR/.local/bin"
          chown -R node:node "$BOT_WORKSPACE_DIR/.cache" "$BOT_WORKSPACE_DIR/.local" 2>/dev/null || true
          export PIP_CACHE_DIR="$BOT_WORKSPACE_DIR/.cache/pip"
          export UV_CACHE_DIR="$BOT_WORKSPACE_DIR/.cache/uv"
          export PATH="$BOT_WORKSPACE_DIR/.local/bin:$PATH"
        fi

        if [ -n "$OPENAI_BASE_URL" ]; then
          echo "Setting base URL for provider $MODEL_PROVIDER: $OPENAI_BASE_URL (api: $OPENCLAW_API_PROTOCOL)"
          # Directly patch openclaw.json with provider config including apiKey and api protocol
          # This is more reliable than CLI config set commands
          node -e "
            const fs = require('fs');
            const configPath = '$JSON_CONFIG_FILE';
            const providerKey = '$MODEL_PROVIDER';
            const apiProtocol = '$OPENCLAW_API_PROTOCOL';
            try {
              const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
              config.models = config.models || {};
              config.models.providers = config.models.providers || {};
              config.models.providers[providerKey] = config.models.providers[providerKey] || {};
              config.models.providers[providerKey].baseUrl = '$OPENAI_BASE_URL';
              // Add the model to the list if not already present (don't clear existing models)
              // OpenClaw expects models as objects with 'name' property
              const modelName = '$AI_MODEL';
              if (!config.models.providers[providerKey].models) {
                config.models.providers[providerKey].models = [];
              }
              const models = config.models.providers[providerKey].models;
              const modelExists = models.some(m => m.id === modelName || m.name === modelName || m === modelName);
              if (modelName && !modelExists) {
                models.push({ id: modelName, name: modelName });
              }
              if ('$API_KEY') {
                config.models.providers[providerKey].apiKey = '$API_KEY';
              }
              if (apiProtocol) {
                config.models.providers[providerKey].api = apiProtocol;
              }
              fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
              process.stdout.write('Patched openclaw.json with provider: ' + providerKey + (apiProtocol ? ' (api: ' + apiProtocol + ')' : '') + '\\\n');
            } catch (e) {
              process.stderr.write('Failed to patch config: ' + e.message + '\\\n');
            }
          " || true
        fi

        # Note: Skipping CLI commands (models set, config set) as they start background services
        # Model and sandbox config are already set directly in openclaw.json above

        # Create auth-profiles.json as a fallback credential source
        # Primary auth is via environment variables (OPENAI_API_KEY, etc.)
        # but auth-profiles.json provides a backup for providers that check it
        export AUTH_BASE_URL="$OPENAI_BASE_URL"
        if [ -z "$AUTH_BASE_URL" ] && [ -n "$PROXY_URL" ]; then
          case "$AUTH_PROVIDER" in
            anthropic) export AUTH_BASE_URL="$PROXY_URL/v1/anthropic" ;;
            gemini) export AUTH_BASE_URL="$PROXY_URL/v1/gemini-compatible" ;;
            *) export AUTH_BASE_URL="$PROXY_URL/v1/openai-compatible" ;;
          esac
        fi

        # IMPORTANT: Include ALL major provider keys to ensure subagents can find auth
        # regardless of which protocol they resolve to
        export AUTH_PROVIDER_KEYS="anthropic openai google custom"

        # Append provider keys from environment variables
        if [ -n "$MODEL_PROVIDER" ]; then
          export AUTH_PROVIDER_KEYS="$AUTH_PROVIDER_KEYS $MODEL_PROVIDER"
        fi
        if [ -n "$MODEL_PREFIX" ] && [ "$MODEL_PREFIX" != "$MODEL_PROVIDER" ]; then
          export AUTH_PROVIDER_KEYS="$AUTH_PROVIDER_KEYS $MODEL_PREFIX"
        fi
        if [ -n "$AUTH_PROVIDER" ] && [ "$AUTH_PROVIDER" != "$MODEL_PROVIDER" ]; then
          export AUTH_PROVIDER_KEYS="$AUTH_PROVIDER_KEYS $AUTH_PROVIDER"
        fi
        if [ -n "$PROVIDER" ] && [ "$PROVIDER" != "$MODEL_PROVIDER" ] && [ "$PROVIDER" != "$AUTH_PROVIDER" ]; then
          export AUTH_PROVIDER_KEYS="$AUTH_PROVIDER_KEYS $PROVIDER"
        fi

        echo "Creating auth-profiles.json for providers:$AUTH_PROVIDER_KEYS"
        # Use Python to generate auth-profiles.json - avoids Node.js heredoc issues
        python3 -c "
import json
import os
keys = list(set([k for k in os.environ.get('AUTH_PROVIDER_KEYS', '').split() if k]))
api_key = os.environ.get('API_KEY', '')
base_url = os.environ.get('AUTH_BASE_URL', '')
auth_profiles_file = os.environ.get('AUTH_PROFILES_FILE', '')
profiles = {}
for key in keys:
    if base_url:
        profiles[key] = {'apiKey': api_key, 'baseUrl': base_url, 'baseURL': base_url}
    else:
        profiles[key] = {'apiKey': api_key}
if auth_profiles_file:
    with open(auth_profiles_file, 'w') as f:
        json.dump(profiles, f, indent=2)
"
        cp "$AUTH_PROFILES_FILE" "$ROOT_AUTH_FILE"
        # Make auth-profiles read-only to prevent gateway from overwriting during init
        chmod 444 "$AUTH_PROFILES_FILE" 2>/dev/null || true
        chmod 444 "$ROOT_AUTH_FILE" 2>/dev/null || true
        echo "Created auth-profiles.json (read-only):"
        cat "$AUTH_PROFILES_FILE"

        # ==================== Merge channels configuration ====================
        # Channels config is stored in /app/secrets/channels.json (mounted from manager)
        # This file is generated by the manager and should be merged into openclaw.json
        # before the gateway starts
        CHANNELS_CONFIG_FILE="/app/secrets/channels.json"
        if [ -f "$CHANNELS_CONFIG_FILE" ]; then
          echo "Merging channels configuration from $CHANNELS_CONFIG_FILE"
          node -e "
            const fs = require('fs');
            const configPath = '$JSON_CONFIG_FILE';
            const channelsPath = '$CHANNELS_CONFIG_FILE';
            try {
              const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
              const channelsConfig = JSON.parse(fs.readFileSync(channelsPath, 'utf8'));

              // Merge channels
              if (channelsConfig.channels) {
                config.channels = { ...config.channels, ...channelsConfig.channels };
                process.stdout.write('Merged channels config into openclaw.json\\n');
                process.stdout.write('Channels: ' + JSON.stringify(Object.keys(channelsConfig.channels)) + '\\n');
                process.stdout.write('Merged channels config into openclaw.json\\n');
                process.stdout.write('Channels: ' + JSON.stringify(Object.keys(channelsConfig.channels)) + '\\n');
              }

              // Merge agents.list
              if (channelsConfig.agents && channelsConfig.agents.list) {
                if (!config.agents) {
                  config.agents = {};
                }
                if (!config.agents.list) {
                  config.agents.list = [];
                }
                // Merge agents: add new agents, update existing ones
                const existingAgentIds = new Set(config.agents.list.map(a => a.id));
                for (const newAgent of channelsConfig.agents.list) {
                  if (!existingAgentIds.has(newAgent.id)) {
                    config.agents.list.push(newAgent);
                  }
                }
                process.stdout.write('Merged agents.list: ' + JSON.stringify(config.agents.list.map(a => a.id)) + '\\n');
              }

              // Merge bindings
              if (channelsConfig.bindings && Array.isArray(channelsConfig.bindings)) {
                if (!config.bindings) {
                  config.bindings = [];
                }
                // Replace bindings entirely (simpler than merging)
                config.bindings = channelsConfig.bindings;
                process.stdout.write('Merged bindings: ' + JSON.stringify(config.bindings.length) + ' binding(s)\\n');
              }

              fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            } catch (e) {
              process.stderr.write('Failed to merge channels config: ' + e.message + '\\n');
              process.stderr.write('Failed to merge channels config: ' + e.message + '\\n');
            }
          " || echo "Warning: Failed to merge channels config"
        else
          echo "No channels config file found at $CHANNELS_CONFIG_FILE"
        fi
        # ==================== End channels merge ====================

        # Restore channels captured before startup overwrote openclaw.json.
        # Merge order: preserved (lowest priority) → channels.json content → existing in config (highest).
        if [ -f "$_OC_PRESERVE_CH" ]; then
          node -e "
            const fs = require('fs');
            try {
              const config = JSON.parse(fs.readFileSync('$JSON_CONFIG_FILE', 'utf8'));
              const preserved = JSON.parse(fs.readFileSync('$_OC_PRESERVE_CH', 'utf8'));
              config.channels = Object.assign({}, preserved, config.channels || {});
              fs.writeFileSync('$JSON_CONFIG_FILE', JSON.stringify(config, null, 2));
              process.stdout.write('Channels preserved from previous run: ' + Object.keys(preserved).join(', ') + '\\\n');
            } catch(e) { process.stderr.write('Failed to restore preserved channels: ' + e.message + '\\\n'); }
          " || true
          rm -f "$_OC_PRESERVE_CH"
        fi

        # Debug: Show final configuration
        echo "=== Final openclaw.json ==="
        cat "$JSON_CONFIG_FILE" 2>/dev/null || echo "Config file not found"
        echo "==========================="
        echo "=== Environment Configuration ==="
        echo "PROVIDER: $PROVIDER"
        echo "AI_VENDOR: $AI_VENDOR"
        echo "AUTH_PROVIDER: $AUTH_PROVIDER"
        echo "MODEL_PROVIDER: $MODEL_PROVIDER"
        echo "FULL_MODEL: $FULL_MODEL"
        echo "AI_API_TYPE: $AI_API_TYPE"
        echo "OPENCLAW_API_PROTOCOL: $OPENCLAW_API_PROTOCOL"
        echo "OPENAI_BASE_URL: $OPENAI_BASE_URL"
        echo "PROXY_URL: $PROXY_URL"
        if [ -n "$PROXY_TOKEN" ]; then echo "PROXY_TOKEN: [SET]"; else echo "PROXY_TOKEN: [NOT SET]"; fi
        if [ -n "$OPENAI_API_KEY" ]; then echo "OPENAI_API_KEY: [SET]"; else echo "OPENAI_API_KEY: [NOT SET]"; fi
        echo "================================="

        # 确保所有目录都有正确的权限
        chown -R node:node "$CONFIG_DIR"
        chmod -R 755 "$CONFIG_DIR"

        # Start the gateway
        # Using exec so gateway becomes PID 1 for proper signal handling
        # If running as root, switch to node user for security
        # --allow-unconfigured allows gateway to start with bootstrap config
        #
        # Note: 'su' starts a new login session for node user, which reads
        # /etc/group and should pick up the docker group membership added by usermod.
        # The docker group was created with GID 1001 (matching host's docker.sock).
        if [ "$(id -u)" = "0" ]; then
          # Verify node user has docker group before starting
          echo "Verifying node user groups before gateway start:"
          id node
          echo "Starting gateway as node user..."
          exec su -s /bin/sh -c "exec node /app/openclaw.mjs gateway --allow-unconfigured --port ${options.port} --bind lan" node
        else
          exec node /app/openclaw.mjs gateway --allow-unconfigured --port ${options.port} --bind lan
        fi
        `,
      ],
      Env: envVars,
      ExposedPorts: {
        [`${options.port}/tcp`]: {},
        ['18792/tcp']: {},
      },
      HostConfig: hostConfig,
      Labels: {
        'clawbot-manager.hostname': options.hostname,
        'clawbot-manager.isolation-key': options.isolationKey,
        'clawbot-manager.managed': 'true',
        'clawbot-manager.bot-type': botType,
      },
    });

    this.logger.info(
      `Container created: ${container.id} (type: ${botType}, image: ${botImage})`,
    );
    return container.id;
  }

  /**
   * Start a container
   */
  async startContainer(containerId: string): Promise<void> {
    if (!this.isAvailable()) {
      this.logger.warn('Docker not available, simulating container start');
      return;
    }

    const container = this.docker.getContainer(containerId);
    await container.start();
    this.logger.info(`Container started: ${containerId}`);
  }

  /**
   * Stop a container
   * @returns true if container was stopped, false if it was already stopped
   */
  async stopContainer(containerId: string): Promise<boolean> {
    if (!this.isAvailable()) {
      this.logger.warn('Docker not available, simulating container stop');
      return true;
    }

    const container = this.docker.getContainer(containerId);
    try {
      await container.stop({ t: 10 }); // 10 second timeout
      this.logger.info(`Container stopped: ${containerId}`);
      return true;
    } catch (error: unknown) {
      // Handle 304 "container already stopped" - this is not an error
      if (
        error &&
        typeof error === 'object' &&
        'statusCode' in error &&
        error.statusCode === 304
      ) {
        this.logger.info(`Container already stopped: ${containerId}`);
        return false;
      }
      throw error;
    }
  }

  /**
   * Remove a container
   */
  async removeContainer(containerId: string): Promise<void> {
    if (!this.isAvailable()) {
      this.logger.warn('Docker not available, simulating container removal');
      return;
    }

    const container = this.docker.getContainer(containerId);
    await container.remove({ force: true });
    this.logger.info(`Container removed: ${containerId}`);
  }

  /**
   * Get container status
   */
  async getContainerStatus(containerId: string): Promise<ContainerInfo | null> {
    return this.statsService.getContainerStatus(containerId);
  }

  /**
   * Check if a container exists
   */
  async containerExists(containerId: string): Promise<boolean> {
    const status = await this.getContainerStatus(containerId);
    return status !== null;
  }

  /**
   * Get container network information
   */
  async getContainerNetworkInfo(containerId: string): Promise<{
    networks: string[];
    ipAddresses: Record<string, string>;
  } | null> {
    return this.statsService.getContainerNetworkInfo(containerId);
  }

  /**
   * Get container stats for all managed containers
   */
  async getAllContainerStats(): Promise<ContainerStats[]> {
    return this.statsService.getAllContainerStats();
  }

  /**
   * Get stats for specific containers by their IDs (no label filter)
   * Used for Gateway Pool containers that may not have managed labels
   */
  async getContainerStatsByIds(
    containerIds: string[],
  ): Promise<ContainerStats[]> {
    return this.statsService.getContainerStatsByIds(containerIds);
  }

  /**
   * List all managed containers with their isolation keys
   * Used by ReconciliationService for orphan detection
   */
  async listManagedContainersWithIsolationKeys(): Promise<
    { id: string; hostname: string; isolationKey: string }[]
  > {
    if (!this.statsService) {
      return [];
    }
    return this.statsService.listManagedContainersWithIsolationKeys();
  }

  /**
   * Find orphaned containers (containers without corresponding database entries)
   * @param knownIsolationKeys - isolation keys (userId_short-hostname) of known bots
   */
  async findOrphanedContainers(
    knownIsolationKeys: string[],
  ): Promise<string[]> {
    return this.orphanCleanerService.findOrphanedContainers(knownIsolationKeys);
  }

  /**
   * Find orphaned workspaces (workspace directories without corresponding database entries)
   * @param knownIsolationKeys - isolation keys of known bots
   */
  async findOrphanedWorkspaces(
    knownIsolationKeys: string[],
  ): Promise<string[]> {
    return this.orphanCleanerService.findOrphanedWorkspaces(knownIsolationKeys);
  }

  /**
   * Find orphaned secrets (secrets directories without corresponding database entries)
   * @param knownIsolationKeys - isolation keys of known bots
   */
  async findOrphanedSecrets(knownIsolationKeys: string[]): Promise<string[]> {
    return this.orphanCleanerService.findOrphanedSecrets(knownIsolationKeys);
  }

  /**
   * Get orphan report
   * @param knownIsolationKeys - isolation keys of known bots
   */
  async getOrphanReport(knownIsolationKeys: string[]): Promise<OrphanReport> {
    return this.orphanCleanerService.getOrphanReport(knownIsolationKeys);
  }

  /**
   * Cleanup orphaned resources
   * @param knownIsolationKeys - isolation keys of known bots
   */
  async cleanupOrphans(knownIsolationKeys: string[]): Promise<CleanupReport> {
    return this.orphanCleanerService.cleanupOrphans(knownIsolationKeys);
  }

  /**
   * List all sandbox containers
   * Sandbox containers are named with pattern: {hostname}-sandbox or openclaw-browser-sandbox
   */
  async listSandboxContainers(): Promise<Docker.ContainerInfo[]> {
    return this.orphanCleanerService.listSandboxContainers();
  }

  /**
   * Find orphaned sandbox containers (no corresponding gateway)
   * @param knownGatewayContainers - list of known gateway container names
   */
  async findOrphanedSandboxContainers(
    knownGatewayContainers: string[],
  ): Promise<SandboxOrphanInfo[]> {
    return this.orphanCleanerService.findOrphanedSandboxContainers(
      knownGatewayContainers,
    );
  }

  /**
   * Cleanup orphaned sandbox containers
   * @param knownGatewayContainers - list of known gateway container names
   * @param gracePeriodMs - grace period in milliseconds before cleanup
   */
  async cleanupOrphanedSandboxes(
    knownGatewayContainers: string[],
    gracePeriodMs: number = 300000,
  ): Promise<SandboxCleanupReport> {
    return this.orphanCleanerService.cleanupOrphanedSandboxes(
      knownGatewayContainers,
      gracePeriodMs,
    );
  }

  /**
   * Allocate a port for a new bot
   * Checks both database records and actual Docker container port bindings
   */
  async allocatePort(usedPorts: number[]): Promise<number> {
    // Get ports actually in use by Docker containers
    let dockerUsedPorts: number[] = [];
    if (this.isAvailable()) {
      try {
        const containers = await this.docker.listContainers({ all: true });
        dockerUsedPorts = containers.flatMap((c) =>
          c.Ports.filter((p) => p.PublicPort).map((p) => p.PublicPort),
        );
      } catch (error) {
        this.logger.warn(
          'Failed to list Docker containers for port allocation',
          error,
        );
      }
    }

    const allUsedPorts = new Set([...usedPorts, ...dockerUsedPorts]);
    let port = Number(this.portStart) || 9200;
    while (allUsedPorts.has(port)) {
      port++;
    }
    return port;
  }

  /**
   * Get container logs
   */
  async getContainerLogs(
    containerId: string,
    options: { tail?: number; since?: number } = {},
  ): Promise<string> {
    if (!this.isAvailable()) {
      return 'Docker not available';
    }

    const container = this.docker.getContainer(containerId);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: options.tail || 100,
      since: options.since,
    });

    return logs.toString();
  }

  /**
   * Execute a command in a running container
   *
   * @param containerId Container ID or name
   * @param command Command to execute
   * @param user User to run the command as (default: node for openclaw commands)
   * @returns Command output (stdout + stderr)
   */
  async execInContainer(
    containerId: string,
    command: string,
    user: string = 'node',
  ): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Docker not available');
    }

    const container = this.docker.getContainer(containerId);

    // Create exec instance
    const exec = await container.exec({
      Cmd: ['/bin/sh', '-c', command],
      AttachStdout: true,
      AttachStderr: true,
      User: user,
    });

    // Start exec and capture output
    const stream = await exec.start({ Detach: false });

    return new Promise((resolve, reject) => {
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      // Docker stream is multiplexed with 8-byte headers
      // Format: [stream_type(1), 0, 0, 0, size(4)]
      container.modem.demuxStream(
        stream,
        {
          write: (chunk: Buffer) => stdoutChunks.push(chunk),
        },
        {
          write: (chunk: Buffer) => stderrChunks.push(chunk),
        },
      );

      stream.on('end', () => {
        const stdout = Buffer.concat(stdoutChunks).toString('utf8').trim();
        const stderr = Buffer.concat(stderrChunks).toString('utf8').trim();
        const output = stderr ? `${stdout}\n${stderr}` : stdout;
        this.logger.debug(`Exec output for "${command}": ${output}`);
        resolve(output);
      });
      stream.on('error', (error: Error) => {
        this.logger.error(`Exec error for "${command}": ${error.message}`);
        reject(error);
      });
    });
  }

  /**
   * Get container by name
   *
   * @param containerName Container name
   * @returns Container ID if found, null otherwise
   */
  async getContainerByName(containerName: string): Promise<string | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const container = this.docker.getContainer(containerName);
      const info = await container.inspect();
      return info.Id;
    } catch {
      return null;
    }
  }

  /**
   * Get container info by name
   *
   * @param containerName Container name
   * @returns Container info if found, null otherwise
   */
  async getContainerInfo(containerName: string): Promise<ContainerInfo | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const container = this.docker.getContainer(containerName);
      const info = await container.inspect();

      return {
        id: info.Id,
        state: info.State.Status,
        running: info.State.Running,
        exitCode: info.State.ExitCode ?? 0,
        startedAt: info.State.StartedAt,
        finishedAt: info.State.FinishedAt ?? '',
      };
    } catch {
      return null;
    }
  }

  /**
   * Get the image ID of a running container
   * Used to compare against the latest built image to detect upgrade availability
   *
   * @param containerId Container ID or name
   * @returns Image ID (sha256:...) or null if not found
   */
  async getContainerImageId(containerId: string): Promise<string | null> {
    if (!this.isAvailable()) return null;
    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();
      return info.Image || null;
    } catch {
      return null;
    }
  }

  /**
   * Get the image ID of a local Docker image by name/tag
   *
   * @param imageName Image name (e.g. "openclaw:local")
   * @returns Image ID (sha256:...) or null if not found
   */
  async getLocalImageId(imageName: string): Promise<string | null> {
    if (!this.isAvailable()) return null;
    try {
      const image = this.docker.getImage(imageName);
      const info = await image.inspect();
      return info.Id || null;
    } catch {
      return null;
    }
  }

  /**
   * Get the gateway image name configured for this service
   */
  getGatewayImageName(): string {
    return this.botImages.GATEWAY;
  }

  /**
   * Pull a Docker image from registry (remote or local)
   * Used to refresh the local copy of the gateway image so we can detect upgrades
   *
   * @param imageName Full image name including tag (e.g. uhub.service.ucloud.cn/pardx/openclaw:latest)
   * @param timeoutMs Pull timeout in milliseconds (default: 5 minutes)
   */
  async pullImage(imageName: string, timeoutMs = 5 * 60 * 1000): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Docker is not available');
    }

    const authconfig = dockerConfig.registryAuth ?? undefined;
    const platform = dockerConfig.platform;

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Pull timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );

      this.docker.pull(
        imageName,
        { authconfig, platform },
        (err: Error | null, stream: NodeJS.ReadableStream) => {
          if (err) {
            clearTimeout(timer);
            return reject(err);
          }
          this.docker.modem.followProgress(
            stream,
            (followErr: Error | null) => {
              clearTimeout(timer);
              if (followErr) reject(followErr);
              else resolve();
            },
          );
        },
      );
    });
  }

  /**
   * Pull image if not exists locally
   * Checks if image exists locally, pulls from registry if missing
   *
   * NOTE: This method does not handle concurrent pulls of the same image.
   * If multiple createContainer() calls race, duplicate pulls may occur.
   * Docker pull is generally safe for concurrent calls, but consider adding
   * a lock mechanism if performance becomes an issue.
   *
   * @param imageName Full image name including tag
   * @param timeoutMs Pull timeout in milliseconds (default: 5 minutes)
   * @throws Error if pull fails or times out
   */
  async pullImageIfNeeded(
    imageName: string,
    timeoutMs = 5 * 60 * 1000,
  ): Promise<void> {
    if (!this.isAvailable()) {
      this.logger.warn('Docker not available, skipping image pull check');
      return;
    }

    // Check if image exists locally
    try {
      const image = this.docker.getImage(imageName);
      await image.inspect();
      this.logger.info(`Image already exists locally: ${imageName}`);
      return;
    } catch {
      this.logger.info(`Image not found locally, pulling: ${imageName}`);
    }

    // Try to pull from remote registry
    try {
      await this.pullImage(imageName, timeoutMs);
      this.logger.info(`Image pulled successfully: ${imageName}`);
    } catch (pullError) {
      this.logger.warn(
        `Failed to pull image ${imageName}: ${pullError instanceof Error ? pullError.message : String(pullError)}`,
      );

      // Fallback: try to build from source
      this.logger.info(`Attempting to build ${imageName} from source...`);
      try {
        await this.dockerImageService.buildImageForName(imageName);
        this.logger.info(`Image built successfully: ${imageName}`);
      } catch (buildError) {
        this.logger.error(
          `Failed to build image ${imageName}: ${buildError instanceof Error ? buildError.message : String(buildError)}`,
        );
        throw pullError; // Throw original pull error
      }
    }
  }

  // ============================================================
  // Sandbox Container Management Methods
  // These methods manage sandbox containers for browser isolation
  // when useExternalSandbox mode is enabled
  // ============================================================

  private readonly sandboxContainerPrefix = 'sandbox-';
  private readonly sandboxImage = dockerConfig.images.browserSandbox;

  /**
   * Create a sandbox container for browser isolation
   * This is used when useExternalSandbox is enabled
   *
   * @param options Sandbox creation options
   * @returns Container ID
   */
  async createSandboxContainer(options: CreateSandboxOptions): Promise<string> {
    if (!this.isAvailable()) {
      this.logger.warn(
        'Docker not available, simulating sandbox container creation',
      );
      return `simulated-sandbox-${options.gatewayKey}`;
    }

    const containerName = `${this.sandboxContainerPrefix}${options.gatewayKey}`;
    const image = options.sandboxImage || this.sandboxImage;
    const cpuLimit = options.cpuLimit ?? 0.5;
    const memoryLimit = options.memoryLimit ?? 1024 * 1024 * 1024; // 1GB

    // Check if container already exists
    try {
      const existing = this.docker.getContainer(containerName);
      const info = await existing.inspect();
      if (info) {
        this.logger.info(
          `Sandbox container ${containerName} already exists, removing...`,
        );
        await existing.remove({ force: true });
      }
    } catch {
      // Container doesn't exist, which is expected
    }

    this.logger.info(
      `Creating sandbox container: ${containerName}, image: ${image}`,
    );

    // Pull image if not exists
    await this.pullImageIfNeeded(image);

    // Create container with required environment variables for browser sandbox
    // These env vars are required by openclaw-sandbox-browser image
    const container = await this.docker.createContainer({
      name: containerName,
      Image: image,
      ExposedPorts: {
        '5900/tcp': {}, // VNC
        '6080/tcp': {}, // noVNC
        '9222/tcp': {}, // CDP
      },
      HostConfig: {
        PortBindings: {
          '5900/tcp': [{ HostPort: '0' }], // Dynamic port allocation
          '6080/tcp': [{ HostPort: '0' }],
          '9222/tcp': [{ HostPort: '0' }],
        },
        NetworkMode: options.networkMode,
        RestartPolicy: { Name: 'unless-stopped' },
        // Resource limits
        CpuQuota: cpuLimit * 100000,
        Memory: memoryLimit,
        MemorySwap: memoryLimit,
        ExtraHosts: ['host.docker.internal:host-gateway'],
        // Required tmpfs for browser sandbox
        Tmpfs: {
          '/tmp': 'rw,noexec,nosuid,size=65536k',
        },
      },
      Env: [
        // Chromium cannot use namespace sandbox inside Docker containers
        // The container itself provides isolation, so --no-sandbox is safe
        'OPENCLAW_BROWSER_NO_SANDBOX=1',
        // CDP port (Chrome DevTools Protocol)
        'OPENCLAW_BROWSER_CDP_PORT=9222',
        // VNC port
        'OPENCLAW_BROWSER_VNC_PORT=5900',
        // noVNC port (WebSocket VNC)
        'OPENCLAW_BROWSER_NOVNC_PORT=6080',
        // Run in non-headless mode to enable VNC visualization
        // Headless mode disables VNC in the startup script
        'OPENCLAW_BROWSER_HEADLESS=0',
        // Enable noVNC for browser visualization
        'OPENCLAW_BROWSER_ENABLE_NOVNC=1',
        // VNC password (fixed for Manager to know)
        'OPENCLAW_BROWSER_NOVNC_PASSWORD=sandbox',
      ],
      Labels: {
        'openclaw.sandbox': '1',
        'openclaw.sandboxBrowser': '1',
        'clawbot-manager.sandbox': 'true',
        'clawbot-manager.gateway-key': options.gatewayKey,
        'clawbot-manager.managed': 'true',
      },
    });

    this.logger.info(
      `Sandbox container created: ${container.id} for gateway ${options.gatewayKey}`,
    );
    return container.id;
  }

  /**
   * Start a sandbox container
   */
  async startSandboxContainer(containerId: string): Promise<void> {
    if (!this.isAvailable()) {
      this.logger.warn(
        'Docker not available, simulating sandbox container start',
      );
      return;
    }

    const container = this.docker.getContainer(containerId);
    await container.start();
    this.logger.info(`Sandbox container started: ${containerId}`);

    // Install Chinese fonts asynchronously (non-blocking)
    // This is done after container start because the sandbox image doesn't include fonts
    // Note: Font installation can take 1-2 minutes, so we run it in background
    this.installSandboxFontsAsync(containerId).catch((err) => {
      this.logger.warn(
        `Background font installation failed for ${containerId}`,
        {
          error: err instanceof Error ? err.message : String(err),
        },
      );
    });
  }

  /**
   * Install Chinese fonts in sandbox container (async, non-blocking)
   */
  private async installSandboxFontsAsync(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      const installCmd = [
        'sh',
        '-c',
        'apt-get update -qq && apt-get install -y -qq fonts-noto-cjk fonts-wqy-zenhei fonts-wqy-microhei 2>/dev/null || true',
      ];
      const exec = await container.exec({
        Cmd: installCmd,
        AttachStdout: true,
        AttachStderr: true,
        User: 'root',
      });
      const stream = await exec.start({});
      await new Promise<void>((resolve) => {
        stream.on('end', () => resolve());
        stream.on('error', () => resolve());
      });
      this.logger.info(
        `Chinese fonts installed in sandbox container: ${containerId}`,
      );
    } catch (fontError) {
      this.logger.warn(
        `Failed to install Chinese fonts in sandbox container: ${containerId}`,
        {
          error:
            fontError instanceof Error ? fontError.message : String(fontError),
        },
      );
    }
  }

  /**
   * Stop a sandbox container
   * @returns true if container was stopped, false if it was already stopped
   */
  async stopSandboxContainer(containerId: string): Promise<boolean> {
    if (!this.isAvailable()) {
      this.logger.warn(
        'Docker not available, simulating sandbox container stop',
      );
      return true;
    }

    const container = this.docker.getContainer(containerId);
    try {
      await container.stop({ t: 10 });
      this.logger.info(`Sandbox container stopped: ${containerId}`);
      return true;
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'statusCode' in error &&
        error.statusCode === 304
      ) {
        this.logger.info(`Sandbox container already stopped: ${containerId}`);
        return false;
      }
      throw error;
    }
  }

  /**
   * Remove a sandbox container
   */
  async removeSandboxContainer(containerId: string): Promise<void> {
    if (!this.isAvailable()) {
      this.logger.warn(
        'Docker not available, simulating sandbox container removal',
      );
      return;
    }

    const container = this.docker.getContainer(containerId);
    await container.remove({ force: true });
    this.logger.info(`Sandbox container removed: ${containerId}`);
  }

  /**
   * Get sandbox container by gateway key
   * @returns Container ID if found, null otherwise
   */
  async getSandboxContainerByGatewayKey(
    gatewayKey: string,
  ): Promise<string | null> {
    const containerName = `${this.sandboxContainerPrefix}${gatewayKey}`;
    return this.getContainerByName(containerName);
  }

  /**
   * Get container port mappings
   * @param containerId Container ID or name
   * @returns Port mappings { 'port/tcp': [{ HostPort: 'xxxx' }] }
   */
  async getContainerPorts(
    containerId: string,
  ): Promise<Record<string, Array<{ HostPort: string; HostIp: string }>>> {
    if (!this.isAvailable()) {
      throw new Error('Docker not available');
    }

    const container = this.docker.getContainer(containerId);
    const info = await container.inspect();
    const ports: Record<
      string,
      Array<{ HostPort: string; HostIp: string }>
    > = {};

    const networkSettings = info.NetworkSettings;
    if (networkSettings?.Ports) {
      for (const [containerPort, bindings] of Object.entries(
        networkSettings.Ports,
      )) {
        if (bindings) {
          ports[containerPort] = (bindings as Array<{ HostPort: string; HostIp?: string }>).map((b) => ({
            HostPort: b.HostPort,
            HostIp: b.HostIp || '0.0.0.0',
          }));
        }
      }
    }

    return ports;
  }

  /**
   * Copy files into a container using Dockerode putArchive API
   * Replaces `docker cp` CLI to avoid environment variable issues
   *
   * @param containerId Container ID or name
   * @param tarBuffer Tar archive buffer containing files to copy
   * @param destPath Destination path inside container (must be a directory)
   */
  async putArchive(
    containerId: string,
    tarBuffer: Buffer,
    destPath: string,
  ): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Docker is not available');
    }

    const container = this.docker.getContainer(containerId);

    // Create a readable stream from the tar buffer
    const { Readable } = require('stream');
    const tarStream = Readable.from(tarBuffer);

    await container.putArchive(tarStream, { path: destPath });

    this.logger.debug(
      `putArchive: Copied tar archive to ${destPath} in container ${containerId.substring(0, 12)}`,
    );
  }

  /**
   * Get files from a container using Dockerode getArchive API
   *
   * @param containerId Container ID or name
   * @param sourcePath Source path inside container
   * @returns Tar archive buffer containing the files
   */
  async getArchive(containerId: string, sourcePath: string): Promise<Buffer> {
    if (!this.isAvailable()) {
      throw new Error('Docker is not available');
    }

    const container = this.docker.getContainer(containerId);

    const stream = await container.getArchive({ path: sourcePath });

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }
}
