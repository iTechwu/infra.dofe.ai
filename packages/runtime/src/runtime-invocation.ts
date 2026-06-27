import type { RuntimeMode } from './runtime-detection';

export interface RuntimeAgentDefinition {
  command: string;
  dockerImage: string;
  configDirName?: string;
  configEnvName?: string;
}

export interface AgentInvocation {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface PlanRuntimeInvocationInput {
  mode: RuntimeMode;
  agent: RuntimeAgentDefinition;
  hostWorkspaceRoot: string;
  containerWorkdir: string;
  agentArgs: (effectiveWorkdir: string) => string[];
  configHostRoot?: string;
  configContainerRoot?: string;
}

export function planRuntimeInvocation(
  input: PlanRuntimeInvocationInput,
): AgentInvocation {
  if (input.mode === 'docker') {
    return planDockerInvocation(input);
  }

  return {
    command: input.agent.command,
    args: input.agentArgs(input.hostWorkspaceRoot),
    cwd: input.hostWorkspaceRoot,
  };
}

export function planDockerInvocation(
  input: PlanRuntimeInvocationInput,
): AgentInvocation {
  const args = [
    'run',
    '--rm',
    '-v',
    buildDockerVolumeArg({
      hostPath: input.hostWorkspaceRoot,
      containerPath: input.containerWorkdir,
    }),
  ];

  const env: Record<string, string> = {};
  if (
    input.agent.configDirName &&
    input.agent.configEnvName &&
    input.configHostRoot &&
    input.configContainerRoot
  ) {
    const hostConfigDir = `${input.configHostRoot}/${input.agent.configDirName}`;
    const containerConfigDir = `${input.configContainerRoot}/${input.agent.configDirName}`;
    args.push(
      '-v',
      buildDockerVolumeArg({
        hostPath: hostConfigDir,
        containerPath: containerConfigDir,
      }),
      '-e',
      `${input.agent.configEnvName}=${containerConfigDir}`,
    );
    env[input.agent.configEnvName] = containerConfigDir;
  }

  args.push(
    '-w',
    input.containerWorkdir,
    input.agent.dockerImage,
    input.agent.command,
    ...input.agentArgs(input.containerWorkdir),
  );

  return {
    command: 'docker',
    args,
    env,
    cwd: input.containerWorkdir,
  };
}

function buildDockerVolumeArg(input: {
  hostPath: string;
  containerPath: string;
  access?: 'ro' | 'rw';
}): string {
  return `${input.hostPath}:${input.containerPath}:${input.access ?? 'rw'}`;
}
