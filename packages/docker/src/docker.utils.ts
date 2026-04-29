/**
 * Docker 工具函数
 * 提供端口分配、镜像管理等工具函数
 */

import Docker from 'dockerode';
import { createContextLogger } from '@/utils/logger-standalone.util';
import { PROVIDER_CONFIGS, type ProviderVendor } from '@repo/contracts';

const logger = createContextLogger('DockerUtils');

/**
 * Parse DOCKER_HOST (or socket path) into Dockerode constructor options.
 * Supports: /var/run/docker.sock, unix:///path, tcp://host:port, http(s)://host:port
 * When DOCKER_HOST is not set or is a socket path, use socketPath; when tcp/http(s), use host+port (socketPath must be null).
 */
export function getDockerConnectionOptions(
  hostOrUrl: string,
): Docker.DockerOptions {
  const s = (hostOrUrl ?? '').trim();
  if (!s) {
    return { socketPath: '/var/run/docker.sock' };
  }
  const tcpMatch = s.match(/^(?:tcp|http|https):\/\/([^:/]+):(\d+)$/i);
  if (tcpMatch) {
    const protocol = s.toLowerCase().startsWith('https') ? 'https' : 'http';
    return {
      protocol: protocol as 'http' | 'https',
      host: tcpMatch[1],
      port: parseInt(tcpMatch[2], 10),
      socketPath: null, // 必须显式置空，否则 dockerode 会优先使用默认 socket
    } as Docker.DockerOptions;
  }
  const path = s.startsWith('unix://') ? s.slice(7) : s;
  return { socketPath: path };
}

/**
 * Convert localhost URLs to host.docker.internal for container access
 */
export function convertToDockerHost(url: string): string {
  return url
    .replace(/127\.0\.0\.1/g, 'host.docker.internal')
    .replace(/localhost/g, 'host.docker.internal');
}

/**
 * Get environment variable name for API key based on provider
 */
export function getApiKeyEnvName(provider: string): string {
  const providerEnvMap: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GOOGLE_API_KEY',
    'azure-openai': 'AZURE_OPENAI_API_KEY',
    groq: 'GROQ_API_KEY',
    mistral: 'MISTRAL_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    venice: 'VENICE_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
    together: 'TOGETHER_API_KEY',
    fireworks: 'FIREWORKS_API_KEY',
    perplexity: 'PERPLEXITY_API_KEY',
    cohere: 'COHERE_API_KEY',
    ollama: 'OLLAMA_API_KEY',
    zhipu: 'ZHIPU_API_KEY',
    moonshot: 'MOONSHOT_API_KEY',
    baichuan: 'BAICHUAN_API_KEY',
    dashscope: 'DASHSCOPE_API_KEY',
    stepfun: 'STEPFUN_API_KEY',
    doubao: 'DOUBAO_API_KEY',
    minimax: 'MINIMAX_API_KEY',
    yi: 'YI_API_KEY',
    hunyuan: 'HUNYUAN_API_KEY',
    silicon: 'SILICONFLOW_API_KEY',
    custom: 'CUSTOM_API_KEY',
  };
  return (
    providerEnvMap[provider] ||
    `${provider.toUpperCase().replace(/-/g, '_')}_API_KEY`
  );
}

/**
 * Get environment variable name for base URL based on provider
 */
export function getBaseUrlEnvName(provider: string): string {
  const baseUrlEnvMap: Record<string, string> = {
    openai: 'OPENAI_BASE_URL',
    anthropic: 'ANTHROPIC_BASE_URL',
    google: 'GOOGLE_BASE_URL',
    'azure-openai': 'AZURE_OPENAI_ENDPOINT',
    groq: 'GROQ_BASE_URL',
    mistral: 'MISTRAL_BASE_URL',
    deepseek: 'DEEPSEEK_BASE_URL',
    venice: 'VENICE_BASE_URL',
    openrouter: 'OPENROUTER_BASE_URL',
    together: 'TOGETHER_BASE_URL',
    fireworks: 'FIREWORKS_BASE_URL',
    perplexity: 'PERPLEXITY_BASE_URL',
    cohere: 'COHERE_BASE_URL',
    ollama: 'OLLAMA_BASE_URL',
    zhipu: 'ZHIPU_BASE_URL',
    moonshot: 'MOONSHOT_BASE_URL',
    baichuan: 'BAICHUAN_BASE_URL',
    dashscope: 'DASHSCOPE_BASE_URL',
    stepfun: 'STEPFUN_BASE_URL',
    doubao: 'DOUBAO_BASE_URL',
    minimax: 'MINIMAX_BASE_URL',
    yi: 'YI_BASE_URL',
    hunyuan: 'HUNYUAN_BASE_URL',
    silicon: 'SILICONFLOW_BASE_URL',
    custom: 'CUSTOM_BASE_URL',
  };
  return (
    baseUrlEnvMap[provider] ||
    `${provider.toUpperCase().replace(/-/g, '_')}_BASE_URL`
  );
}

/**
 * Get provider config from PROVIDER_CONFIGS
 */
export function getProviderConfig(aiProvider: string) {
  return PROVIDER_CONFIGS[aiProvider as ProviderVendor];
}

/**
 * Allocate an available port
 * @param docker - Docker instance
 * @param usedPorts - List of already used ports
 * @param portStart - Starting port number
 * @param containerPrefix - Container name prefix
 */
export async function allocatePort(
  docker: Docker | null,
  usedPorts: number[],
  portStart: number,
  containerPrefix: string,
): Promise<number> {
  // Get ports used by existing containers
  const containerPorts: number[] = [];

  if (docker) {
    try {
      const containers = await docker.listContainers({
        all: true,
        filters: { label: ['clawbot-manager.managed=true'] },
      });

      for (const container of containers) {
        // Only check containers managed by clawbot-manager
        if (!container.Names[0]?.startsWith('/' + containerPrefix)) {
          continue;
        }
        for (const port of container.Ports) {
          if (port.PublicPort) {
            containerPorts.push(port.PublicPort);
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to list containers for port allocation', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Combine with explicitly used ports
  const allUsedPorts = new Set([...usedPorts, ...containerPorts]);

  // Find first available port
  let port = portStart;
  while (allUsedPorts.has(port)) {
    port++;
  }

  return port;
}

/**
 * Get container image ID
 */
export async function getContainerImageId(
  docker: Docker | null,
  containerId: string,
): Promise<string | null> {
  if (!docker) {
    return null;
  }

  try {
    const container = docker.getContainer(containerId);
    const info = await container.inspect();
    return info.Image || null;
  } catch {
    return null;
  }
}

/**
 * Get local image ID by image name
 */
export async function getLocalImageId(
  docker: Docker | null,
  imageName: string,
): Promise<string | null> {
  if (!docker) {
    return null;
  }

  try {
    const image = docker.getImage(imageName);
    const info = await image.inspect();
    return info.Id || null;
  } catch {
    return null;
  }
}

/**
 * Pull Docker image with timeout
 */
export async function pullImage(
  docker: Docker | null,
  imageName: string,
  timeoutMs = 5 * 60 * 1000,
): Promise<void> {
  if (!docker) {
    logger.warn(`Docker not available, skipping image pull: ${imageName}`);
    return;
  }

  logger.info(`Pulling image: ${imageName}`);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Image pull timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    docker.pull(
      imageName,
      (err: Error | null, stream: NodeJS.ReadableStream) => {
        if (err) {
          clearTimeout(timeout);
          reject(err);
          return;
        }

        docker.modem.followProgress(
          stream,
          (err: Error | null) => {
            clearTimeout(timeout);
            if (err) {
              reject(err);
            } else {
              logger.info(`Successfully pulled image: ${imageName}`);
              resolve();
            }
          },
          (event: { status?: string; id?: string; progress?: string }) => {
            if (event.status) {
              logger.info(
                `Pull ${imageName}: ${event.status}${event.id ? ` (${event.id})` : ''}${event.progress ? ` - ${event.progress}` : ''}`,
              );
            }
          },
        );
      },
    );
  });
}

/**
 * Execute command in container
 */
export async function execInContainer(
  docker: Docker | null,
  containerId: string,
  command: string,
): Promise<string> {
  if (!docker) {
    throw new Error('Docker not available');
  }

  const container = docker.getContainer(containerId);

  const exec = await container.exec({
    AttachStdout: true,
    AttachStderr: true,
    Cmd: ['/bin/sh', '-c', command],
  });

  const stream = await exec.start({ Detach: false });

  return new Promise((resolve, reject) => {
    let output = '';
    stream.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    stream.on('end', () => resolve(output));
    stream.on('error', reject);
  });
}
