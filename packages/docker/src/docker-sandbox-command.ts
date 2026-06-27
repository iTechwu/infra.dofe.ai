import type {
  DockerSandboxProfile,
  DockerSandboxRunOptions,
  DockerSandboxValidation,
} from './docker-sandbox.types';

export function buildDockerSandboxRunCommand(
  opts: DockerSandboxRunOptions,
): string[] {
  const cmd: string[] = ['docker', 'run', '--rm'];
  cmd.push(`--network=${opts.networkMode}`);
  if (opts.readonlyRootfs) cmd.push('--read-only');

  const capDrop = opts.capDrop.length > 0 ? opts.capDrop : ['ALL'];
  for (const cap of capDrop) cmd.push(`--cap-drop=${cap}`);
  for (const cap of opts.capAdd ?? []) cmd.push(`--cap-add=${cap}`);

  if (opts.memoryLimitMb) cmd.push(`--memory=${opts.memoryLimitMb}m`);
  if (opts.cpuLimit) cmd.push(`--cpus=${opts.cpuLimit}`);
  cmd.push('-v', `${opts.mountPath}:${opts.workdir}`);
  cmd.push('-w', opts.workdir);
  cmd.push('--security-opt=no-new-privileges:true');

  for (const [key, value] of Object.entries(opts.envVars ?? {})) {
    cmd.push('-e', `${key}=${value}`);
  }

  cmd.push(opts.image);
  cmd.push(opts.command);
  if (opts.args?.length) cmd.push(...opts.args);
  return cmd;
}

export function buildDockerSandboxedExec(
  opts: DockerSandboxRunOptions,
): { command: string; args: string[] } {
  const fullCmd = buildDockerSandboxRunCommand(opts);
  return { command: fullCmd[0], args: fullCmd.slice(1) };
}

export function describeDockerSandboxProfile(
  opts: DockerSandboxRunOptions,
): DockerSandboxProfile {
  return {
    network:
      opts.networkMode === 'none'
        ? 'deny'
        : opts.networkMode === 'bridge'
          ? 'allowlist'
          : 'open-with-approval',
    writeScope: opts.readonlyRootfs ? 'artifact-only' : 'repo',
    shellEnforcement: opts.capDrop.includes('ALL'),
    secretMode: opts.envVars?.SECRET_REDACT ? 'redacted' : 'blocked',
    memoryLimitMb: opts.memoryLimitMb ?? 512,
    cpuLimit: opts.cpuLimit ?? 1,
  };
}

export function validateDockerSandboxProfile(
  opts: DockerSandboxRunOptions,
): DockerSandboxValidation {
  const warnings: string[] = [];
  if (opts.networkMode !== 'none') {
    warnings.push('Network is not fully denied; consider --network=none');
  }
  if (!opts.readonlyRootfs) {
    warnings.push('Root filesystem is writable; consider --read-only');
  }
  if (!opts.capDrop.includes('ALL')) {
    warnings.push('Not all capabilities dropped; add --cap-drop=ALL');
  }
  if ((opts.capAdd ?? []).includes('SYS_ADMIN')) {
    warnings.push('SYS_ADMIN is dangerous in sandbox');
  }
  if (opts.memoryLimitMb && opts.memoryLimitMb > 4096) {
    warnings.push(`Memory limit (${opts.memoryLimitMb}MB) exceeds 4GB`);
  }
  return { valid: warnings.length === 0, warnings };
}
