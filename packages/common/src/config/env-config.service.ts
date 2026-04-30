/**
 * Environment Configuration Service
 *
 * 提供类型安全的环境变量访问，替代直接使用 process.env
 *
 * 使用方式:
 * 1. 直接导入函数: import { getEnv } from '@/common/config/env-config.service';
 * 2. 在服务中使用: const botDataDir = getEnv('BOT_DATA_DIR');
 *
 * 注意: 此服务在模块初始化后使用，启动时的配置加载仍使用 configuration.ts
 */
import { getEnvConfig, getConfig } from './configuration';
import type { EnvConfig } from './validation';

/**
 * 缓存的环境配置
 */
let cachedEnv: EnvConfig | undefined;

/**
 * 获取已验证的环境配置
 * 如果配置未初始化，返回 process.env 作为 fallback
 */
function getValidatedEnv(): Partial<EnvConfig> {
  if (cachedEnv) {
    return cachedEnv;
  }

  // 尝试从配置服务获取
  const envConfig = getEnvConfig();
  if (envConfig) {
    cachedEnv = envConfig;
    return envConfig;
  }

  // Fallback: 直接使用 process.env（非验证模式）
  return process.env as unknown as Partial<EnvConfig>;
}

/**
 * 获取单个环境变量（类型安全）
 *
 * @param key - 环境变量名
 * @returns 环境变量值
 *
 * @example
 * const botDataDir = getEnv('BOT_DATA_DIR'); // string
 * const port = getEnv('API_PORT'); // number (自动转换)
 * const optional = getEnv('MODE_USER_ID'); // string | undefined
 */
export function getEnv<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
  const env = getValidatedEnv();
  return env[key] as EnvConfig[K];
}

/**
 * 获取环境变量，带默认值
 *
 * @param key - 环境变量名
 * @param defaultValue - 默认值
 * @returns 环境变量值或默认值
 *
 * @example
 * const dir = getEnvWithDefault('BOT_DATA_DIR', '/data/bots');
 */
export function getEnvWithDefault<K extends keyof EnvConfig>(
  key: K,
  defaultValue: NonNullable<EnvConfig[K]>,
): NonNullable<EnvConfig[K]> {
  const value = getEnv(key);
  return (value ?? defaultValue) as NonNullable<EnvConfig[K]>;
}

/**
 * 检查环境变量是否设置
 *
 * @param key - 环境变量名
 * @returns 是否设置
 */
export function hasEnv(key: keyof EnvConfig): boolean {
  const env = getValidatedEnv();
  return env[key] !== undefined && env[key] !== '';
}

/**
 * 获取当前运行环境
 */
export function getNodeEnv(): string {
  return getEnv('NODE_ENV') || 'dev';
}

/**
 * 是否为生产环境
 */
export function isProduction(): boolean {
  const env = getNodeEnv();
  return env.startsWith('prod');
}

/**
 * 是否为开发环境
 */
export function isDevelopment(): boolean {
  return getNodeEnv() === 'dev';
}

/**
 * 获取项目根目录
 */
export function getProjectRoot(): string {
  const root = getEnv('PROJECT_ROOT');
  if (root?.includes('$(pwd)')) {
    return root.replace('$(pwd)', process.cwd());
  }
  return root || process.cwd();
}

// ============================================================================
// 分类配置获取器（便捷方法）
// ============================================================================

/**
 * Docker/Bot 容器配置
 */
export const dockerConfig = {
  get images() {
    return {
      gateway: getEnvWithDefault('BOT_IMAGE_GATEWAY', 'openclaw:latest'),
      // Sandbox images - configurable via environment variables
      toolSandbox: getEnvWithDefault('BOT_IMAGE_TOOL_SANDBOX', 'openclaw-sandbox:bookworm-slim'),
      browserSandbox: getEnvWithDefault('BOT_IMAGE_BROWSER_SANDBOX', 'openclaw-sandbox-browser:bookworm-slim'),
    };
  },

  get limits() {
    return {
      cpu: Number(getEnvWithDefault('GATEWAY_CONTAINER_CPU_LIMIT', 1)),
      memory: Number(
        getEnvWithDefault('GATEWAY_CONTAINER_MEMORY_LIMIT', 2147483648),
      ),
    };
  },

  get directories() {
    return {
      data: getEnvWithDefault('BOT_DATA_DIR', '/data/bots'),
      secrets: getEnvWithDefault('BOT_SECRETS_DIR', '/data/secrets'),
      openclaw: getEnvWithDefault('BOT_OPENCLAW_DIR', '/data/openclaw'),
    };
  },

  get volumes() {
    return {
      data: getEnv('DATA_VOLUME_NAME'),
      secrets: getEnv('SECRETS_VOLUME_NAME'),
      openclaw: getEnv('OPENCLAW_VOLUME_NAME'),
    };
  },

  get portStart() {
    return getEnvWithDefault('GATEWAY_DOCKER_PORT_START', 9200);
  },

  get openclawSrcPath() {
    return getEnvWithDefault('OPENCLAW_SRC_PATH', '../openclaw');
  },

  get npmRegistry() {
    return getEnv('NPM_CONFIG_REGISTRY');
  },

  get dockerHost() {
    return getEnvWithDefault('DOCKER_HOST', '/var/run/docker.sock');
  },

  get platform() {
    return getEnvWithDefault('DOCKER_PLATFORM', 'linux/amd64');
  },

  get registryAuth() {
    const username = getEnv('DOCKER_REGISTRY_USERNAME');
    const password = getEnv('DOCKER_REGISTRY_PASSWORD');
    const serveraddress = getEnv('DOCKER_REGISTRY_SERVER');
    if (!username || !password) return null;
    return { username, password, serveraddress: serveraddress || undefined };
  },

  get mcpBuildDir() {
    return getEnvWithDefault('MCP_BUILD_DIR', '/tmp/mcp-builds');
  },

  get sandboxCleanup() {
    return {
      idleThresholdMs: Number(
        getEnvWithDefault('SANDBOX_IDLE_THRESHOLD_MS', 3600000), // 1 小时
      ),
      gracePeriodMs: Number(
        getEnvWithDefault('SANDBOX_GRACE_PERIOD_MS', 300000), // 5 分钟
      ),
    };
  },
} as const;

/**
 * S3 存储配置
 * 优先读取 config.local.yaml 的 app 段，环境变量作为 fallback
 */
export const s3Config = {
  get enableRetry() {
    return (
      getConfig()?.app?.enableRetryMechanism ??
      getEnv('S3_ENABLE_RETRY') ??
      true
    );
  },

  get enhancedLogging() {
    return (
      getConfig()?.app?.enableEnhancedLogging ??
      getEnv('S3_ENHANCED_LOGGING') ??
      true
    );
  },

  get maxRetries() {
    return (
      getConfig()?.app?.maxRetries ?? getEnvWithDefault('S3_MAX_RETRIES', 3)
    );
  },

  get retryDelay() {
    return (
      getConfig()?.app?.baseRetryDelay ??
      getEnvWithDefault('S3_RETRY_DELAY', 1000)
    );
  },
} as const;

/**
 * 功能开关配置
 */
export const featureConfig = {
  get swaggerEnabled() {
    const value = getEnv('SWAGGER_ENABLE');
    return value === true;
  },

  get proxyPreferStats() {
    const value = getEnv('PROXY_PREFER_STATS');
    return value === true;
  },

  get proxyTokenTtl() {
    return getEnvWithDefault('PROXY_TOKEN_TTL', 86400);
  },

  get zeroTrustMode() {
    return getEnv('ZERO_TRUST_MODE');
  },

  get modeUserId() {
    return getEnv('MODE_USER_ID');
  },
} as const;

/**
 * 审计相关配置
 */
export const auditConfig = {
  /** 审计签名密钥（生产环境必须设置） */
  get signatureSecret() {
    return getEnv('AUDIT_SIGNATURE_SECRET');
  },

  /** 是否启用 detail 脱敏 */
  get maskEnabled() {
    return getEnv('AUDIT_MASK_ENABLED') ?? true;
  },

  /** Gateway 审计上报超时（毫秒） */
  get gatewayAuditTimeoutMs() {
    return getEnvWithDefault('GATEWAY_AUDIT_TIMEOUT_MS', 5000);
  },

  /** Gateway 审计上报端点（可选，默认由 API_BASE_URL 拼接） */
  get gatewayAuditEndpoint() {
    return getEnv('GATEWAY_AUDIT_ENDPOINT');
  },

  /** API Base URL（用于拼接 Gateway 审计端点） */
  get apiBaseUrl() {
    return (
      getEnv('API_BASE_URL') ||
      getEnv('INTERNAL_API_BASE_URL') ||
      'http://localhost:3100'
    );
  },
} as const;

/**
 * Model Capability Research 配置
 */
export const researchConfig = {
  /** API Base URL（用于调用内部代理端点） */
  get apiBaseUrl() {
    return (
      getEnv('API_BASE_URL') ||
      getEnv('INTERNAL_API_BASE_URL') ||
      'http://localhost:3100'
    );
  },

  /** 专用内部研究 Bot 的代理 Token */
  get researchBotProxyToken() {
    return getEnv('RESEARCH_BOT_PROXY_TOKEN');
  },

  /** Anthropic-compatible 代理端点路径 */
  get anthropicCompatiblePath() {
    return '/api/v1/anthropic-compatible/v1/messages';
  },

  /** 完整的研究代理端点 URL */
  get researchProxyEndpoint() {
    return `${this.apiBaseUrl}${this.anthropicCompatiblePath}`;
  },
} as const;

/**
 * 服务构建信息
 */
export const buildConfig = {
  get serverName() {
    return getEnvWithDefault('MICRO_SERVER_NAME', 'api');
  },

  get serverBuild() {
    return getEnv('SERVER_BUILD');
  },

  get gitCommitHash() {
    return getEnv('GIT_COMMIT_HASH') || getEnv('VERCEL_GIT_COMMIT_SHA');
  },
} as const;

/**
 * 清除缓存（用于测试）
 */
export function clearEnvCache(): void {
  cachedEnv = undefined;
}
