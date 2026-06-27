export type DockerVolumeAccess = 'ro' | 'rw';

export interface DockerVolumeArgInput {
  hostPath: string;
  containerPath: string;
  access?: DockerVolumeAccess;
}

export function buildDockerVolumeArg(input: DockerVolumeArgInput): string {
  return `${input.hostPath}:${input.containerPath}:${input.access ?? 'rw'}`;
}
