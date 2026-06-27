export interface DockerSandboxRunOptions {
  image: string;
  command: string;
  args?: string[];
  workdir: string;
  mountPath: string;
  networkMode: 'none' | 'host' | 'bridge';
  readonlyRootfs: boolean;
  capDrop: string[];
  capAdd?: string[];
  memoryLimitMb?: number;
  cpuLimit?: number;
  timeoutSec?: number;
  envVars?: Record<string, string>;
}

export interface DockerSandboxRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  sandboxProfile: DockerSandboxProfile;
}

export interface DockerSandboxProfile {
  network: 'deny' | 'allowlist' | 'open-with-approval';
  writeScope: 'workspace' | 'repo' | 'artifact-only';
  shellEnforcement: boolean;
  secretMode: 'redacted' | 'blocked';
  memoryLimitMb: number;
  cpuLimit: number;
}

export interface DockerSandboxValidation {
  valid: boolean;
  warnings: string[];
}
