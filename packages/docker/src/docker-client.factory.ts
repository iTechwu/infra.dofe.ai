import Docker from 'dockerode';
import { getDockerConnectionOptions } from './docker.utils';

const DEFAULT_DOCKER_HOST = '/var/run/docker.sock';
const DEFAULT_TIMEOUT_MS = 8000;

export interface DockerClientOptions {
  dockerHost?: string;
}

export interface DockerDaemonProbe {
  ok: boolean;
  version?: string;
  message?: string;
}

export function createDockerClient(options: DockerClientOptions = {}): Docker {
  return new Docker(
    getDockerConnectionOptions(options.dockerHost ?? DEFAULT_DOCKER_HOST),
  );
}

export async function probeDockerDaemon(
  docker: Docker,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<DockerDaemonProbe> {
  try {
    await withDockerTimeout(docker.ping(), timeoutMs, 'docker ping');
    const dockerWithVersion = docker as Docker & {
      version(): Promise<{ Version?: string; ServerVersion?: string }>;
    };
    const version = await withDockerTimeout(
      dockerWithVersion.version(),
      timeoutMs,
      'docker version',
    );
    return {
      ok: true,
      version: (version.ServerVersion ?? version.Version)?.slice(0, 120),
    };
  } catch (error) {
    return {
      ok: false,
      message: safeDockerMessage(error),
    };
  }
}

export async function withDockerTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function safeDockerMessage(error: unknown, maxLength = 240): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, maxLength);
}
