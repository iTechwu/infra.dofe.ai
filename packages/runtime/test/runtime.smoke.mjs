import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRuntimeChecks,
  pickRuntimeCandidate,
  planRuntimeInvocation,
} from '../dist/index.js';

const messages = {
  LOCAL_CLI_MISSING: 'Local CLI missing',
  DOCKER_DAEMON_DOWN: 'Docker down',
  DOCKER_IMAGE_MISSING: 'Image missing',
  WORKSPACE_REQUIRED: 'Workspace required',
  WORKSPACE_NOT_MOUNTABLE: 'Workspace not mountable',
  AUTH_REQUIRED: 'Auth required',
};

test('pickRuntimeCandidate prefers ready preference and falls back predictably', () => {
  const local = { mode: 'local-cli', status: 'missing', workspaceRequired: false };
  const docker = { mode: 'docker', status: 'ready', workspaceRequired: true };
  assert.equal(pickRuntimeCandidate('local-cli', local, docker), docker);
});

test('buildRuntimeChecks emits local missing as info when Docker covers it', () => {
  const checks = buildRuntimeChecks({
    preferredMode: 'local-cli',
    workspaceStatus: 'VALIDATED',
    local: { mode: 'local-cli', status: 'missing', workspaceRequired: false },
    docker: { mode: 'docker', status: 'ready', workspaceRequired: true },
    selected: { mode: 'docker', status: 'ready', workspaceRequired: true },
    messages,
  });
  assert.deepEqual(checks.map((check) => [check.code, check.level, check.action]), [
    ['LOCAL_CLI_MISSING', 'info', 'use-docker'],
  ]);
});

test('planRuntimeInvocation wraps Docker agent args with container workdir', () => {
  const invocation = planRuntimeInvocation({
    mode: 'docker',
    agent: {
      command: 'codex',
      dockerImage: 'example/codex:latest',
      configDirName: 'codex',
      configEnvName: 'CODEX_HOME',
    },
    hostWorkspaceRoot: '/host/repo',
    containerWorkdir: '/workspace',
    configHostRoot: '/host/repo/.loops/runtime',
    configContainerRoot: '/workspace/.loops/runtime',
    agentArgs: (workdir) => ['--add-dir', workdir],
  });

  assert.equal(invocation.command, 'docker');
  assert.ok(invocation.args.includes('/host/repo:/workspace:rw'));
  assert.ok(invocation.args.includes('/workspace'));
  assert.ok(!invocation.args.includes('/host/repo'));
  assert.equal(invocation.env.CODEX_HOME, '/workspace/.loops/runtime/codex');
});
