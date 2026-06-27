export type RuntimeMode = 'local-cli' | 'docker';
export type RuntimeStatus = 'ready' | 'missing' | 'misconfigured' | 'error';
export type RuntimeCheckLevel = 'info' | 'warning' | 'critical';

export interface RuntimeCandidate {
  mode: RuntimeMode;
  status: RuntimeStatus;
  command?: string;
  image?: string;
  version?: string;
  workspaceRequired: boolean;
}

export interface RuntimeCheck {
  code:
    | 'LOCAL_CLI_MISSING'
    | 'DOCKER_DAEMON_DOWN'
    | 'DOCKER_IMAGE_MISSING'
    | 'WORKSPACE_REQUIRED'
    | 'WORKSPACE_NOT_MOUNTABLE'
    | 'AUTH_REQUIRED';
  level: RuntimeCheckLevel;
  action: string;
  message: string;
}

export interface RuntimeCheckMessages {
  LOCAL_CLI_MISSING: string;
  DOCKER_DAEMON_DOWN: string;
  DOCKER_IMAGE_MISSING: string;
  WORKSPACE_REQUIRED: string;
  WORKSPACE_NOT_MOUNTABLE: string;
  AUTH_REQUIRED: string;
}

export interface BuildRuntimeChecksInput {
  preferredMode: RuntimeMode;
  workspaceStatus: 'VALIDATED' | 'ERROR' | string;
  local?: RuntimeCandidate;
  docker?: RuntimeCandidate;
  selected?: RuntimeCandidate;
  messages: RuntimeCheckMessages;
}

export function pickRuntimeCandidate(
  preferredMode: RuntimeMode,
  local?: RuntimeCandidate,
  docker?: RuntimeCandidate,
): RuntimeCandidate | undefined {
  const preferredCandidate = preferredMode === 'docker' ? docker : local;
  if (preferredCandidate?.status === 'ready') return preferredCandidate;
  if (local?.status === 'ready') return local;
  if (docker?.status === 'ready') return docker;
  return undefined;
}

export function buildRuntimeChecks(input: BuildRuntimeChecksInput): RuntimeCheck[] {
  const checks: RuntimeCheck[] = [];
  const workspaceOk = input.workspaceStatus === 'VALIDATED';
  const dockerPreferred =
    input.preferredMode === 'docker' || input.selected?.mode === 'docker';

  if (!workspaceOk) {
    checks.push(
      input.workspaceStatus === 'ERROR'
        ? runtimeCheck(input.messages, 'WORKSPACE_NOT_MOUNTABLE', 'critical', 'select-workspace')
        : runtimeCheck(input.messages, 'WORKSPACE_REQUIRED', 'critical', 'select-workspace'),
    );
  }

  if (input.local && input.local.status !== 'ready') {
    const dockerCovers = input.docker?.status === 'ready' && workspaceOk;
    checks.push(
      runtimeCheck(
        input.messages,
        'LOCAL_CLI_MISSING',
        dockerCovers ? 'info' : 'warning',
        dockerCovers ? 'use-docker' : 'view-setup-guide',
      ),
    );
  }

  if (input.docker) {
    if (input.docker.status === 'error') {
      checks.push(runtimeCheck(input.messages, 'DOCKER_DAEMON_DOWN', 'critical', 'open-docker'));
    } else if (input.docker.status === 'missing') {
      checks.push(runtimeCheck(input.messages, 'DOCKER_IMAGE_MISSING', 'warning', 'pull-image'));
    }
  }

  if (
    dockerPreferred &&
    !workspaceOk &&
    !checks.some((check) => check.code === 'WORKSPACE_REQUIRED')
  ) {
    checks.push(runtimeCheck(input.messages, 'WORKSPACE_REQUIRED', 'critical', 'select-workspace'));
  }

  return checks;
}

export function runtimeCheck(
  messages: RuntimeCheckMessages,
  code: RuntimeCheck['code'],
  level: RuntimeCheck['level'],
  action: string,
  message?: string,
): RuntimeCheck {
  return { code, level, action, message: message ?? messages[code] };
}
