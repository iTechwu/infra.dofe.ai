import Docker from 'dockerode';
import { getLocalImageId, pullImage } from './docker.utils';
import { safeDockerMessage, withDockerTimeout } from './docker-client.factory';

const DEFAULT_PULL_TIMEOUT_MS = 300_000;

export interface DockerRegistryAuth {
  username: string;
  password: string;
  serveraddress: string;
}

export interface DockerPullOptions {
  image: string;
  timeoutMs?: number;
  platform?: string;
  registryAuth?: DockerRegistryAuth;
}

export interface DockerPullOutcome {
  ok: boolean;
  message: string;
}

export interface DockerImagePresence {
  present: boolean;
  imageId: string | null;
}

export async function inspectDockerImage(
  docker: Docker | null,
  image: string,
  timeoutMs = 8000,
): Promise<DockerImagePresence> {
  try {
    const imageId = await withDockerTimeout(
      getLocalImageId(docker, image),
      timeoutMs,
      'docker image inspect',
    );
    return { present: imageId !== null, imageId };
  } catch {
    return { present: false, imageId: null };
  }
}

export async function pullDockerImage(
  docker: Docker | null,
  options: DockerPullOptions,
): Promise<DockerPullOutcome> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_PULL_TIMEOUT_MS;
  if (!docker) {
    return { ok: false, message: 'Docker is not available.' };
  }

  try {
    if (options.registryAuth || options.platform) {
      await pullWithDockerode(docker, options, timeoutMs);
    } else {
      await pullImage(docker, options.image, timeoutMs);
    }
    return {
      ok: true,
      message: `Image ${options.image} pulled successfully.`,
    };
  } catch (error) {
    const message = redactDockerAuth(
      safeDockerMessage(error),
      options.registryAuth,
    );
    return { ok: false, message };
  }
}

export function registryAuthFromEnv(
  image: string,
  env: NodeJS.ProcessEnv = process.env,
): DockerRegistryAuth | undefined {
  const username = env.DOCKER_REGISTRY_USERNAME?.trim();
  const password = env.DOCKER_REGISTRY_PASSWORD?.trim();
  if (!username || !password) return undefined;

  const configuredServer = stripRegistryScheme(
    env.DOCKER_REGISTRY_SERVER?.trim() ?? '',
  );
  const imageRegistry = registryFromImage(image);
  const target = configuredServer || imageRegistry;
  if (!target) return undefined;
  if (configuredServer && configuredServer !== imageRegistry) return undefined;

  return {
    username,
    password,
    serveraddress: normalizeRegistryServer(target),
  };
}

export function redactDockerAuth(
  message: string,
  auth: DockerRegistryAuth | undefined,
): string {
  if (!auth) return message;
  let redacted = message;
  if (auth.password) redacted = redacted.split(auth.password).join('***');
  if (auth.username) redacted = redacted.split(auth.username).join('***');
  return redacted;
}

export function registryFromImage(image: string): string {
  const host = image.split('/')[0] ?? '';
  return /[.:]/.test(host) || host === 'localhost' ? host : '';
}

export function stripRegistryScheme(server: string): string {
  return server.replace(/^https?:\/\//i, '');
}

export function normalizeRegistryServer(server: string): string {
  if (!server) return '';
  return /^https?:\/\//i.test(server) ? server : `https://${server}`;
}

function pullWithDockerode(
  docker: Docker,
  options: DockerPullOptions,
  timeoutMs: number,
): Promise<void> {
  const pull = new Promise<void>((resolve, reject) => {
    docker.pull(
      options.image,
      {
        ...(options.platform ? { platform: options.platform } : {}),
        ...(options.registryAuth ? { authconfig: options.registryAuth } : {}),
      },
      (error, stream) => {
        if (error) {
          reject(error);
          return;
        }
        if (!stream) {
          resolve();
          return;
        }
        docker.modem.followProgress(stream, (progressError: Error | null) => {
          if (progressError) {
            reject(progressError);
            return;
          }
          resolve();
        });
      },
    );
  });
  return withDockerTimeout(pull, timeoutMs, 'docker pull');
}
