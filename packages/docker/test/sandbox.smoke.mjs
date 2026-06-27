import assert from 'node:assert/strict';
import test from 'node:test';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  buildDockerSandboxRunCommand,
  buildDockerSandboxedExec,
  describeDockerSandboxProfile,
  validateDockerSandboxProfile,
} from '../dist/docker-sandbox-command.js';
import { executeDockerSandbox as runSandbox } from '../dist/docker-sandbox-runner.js';

const baseOptions = {
  image: 'example/sandbox:latest',
  command: 'node',
  args: ['script.js'],
  workdir: '/workspace',
  mountPath: '/host/repo',
  networkMode: 'none',
  readonlyRootfs: true,
  capDrop: ['ALL'],
  memoryLimitMb: 256,
  cpuLimit: 0.5,
  timeoutSec: 2,
  envVars: {
    API_TOKEN: 'secret-token',
    PUBLIC_FLAG: 'visible',
  },
};

test('buildDockerSandboxRunCommand locks down the default sandbox shape', () => {
  const cmd = buildDockerSandboxRunCommand(baseOptions);

  assert.deepEqual(cmd.slice(0, 3), ['docker', 'run', '--rm']);
  assert.ok(cmd.includes('--network=none'));
  assert.ok(cmd.includes('--read-only'));
  assert.ok(cmd.includes('--cap-drop=ALL'));
  assert.ok(cmd.includes('--security-opt=no-new-privileges:true'));
  assert.ok(cmd.includes('--memory=256m'));
  assert.ok(cmd.includes('--cpus=0.5'));
  assert.ok(cmd.includes('/host/repo:/workspace'));
  assert.ok(cmd.includes('-w'));
  assert.ok(cmd.includes('/workspace'));
  assert.ok(cmd.includes('-e'));
  assert.ok(cmd.includes('API_TOKEN=secret-token'));
  assert.deepEqual(cmd.slice(-3), ['example/sandbox:latest', 'node', 'script.js']);
});

test('buildDockerSandboxedExec separates docker command from argv', () => {
  const exec = buildDockerSandboxedExec(baseOptions);
  assert.equal(exec.command, 'docker');
  assert.equal(exec.args[0], 'run');
  assert.equal(exec.args.includes('docker'), false);
});

test('describe and validate sandbox profiles expose security posture', () => {
  assert.deepEqual(describeDockerSandboxProfile(baseOptions), {
    network: 'deny',
    writeScope: 'artifact-only',
    shellEnforcement: true,
    secretMode: 'blocked',
    memoryLimitMb: 256,
    cpuLimit: 0.5,
  });
  assert.deepEqual(validateDockerSandboxProfile(baseOptions), {
    valid: true,
    warnings: [],
  });

  const unsafe = validateDockerSandboxProfile({
    ...baseOptions,
    networkMode: 'bridge',
    readonlyRootfs: false,
    capDrop: [],
    capAdd: ['SYS_ADMIN'],
    memoryLimitMb: 8192,
  });
  assert.equal(unsafe.valid, false);
  assert.equal(unsafe.warnings.length, 5);
});

test('executeDockerSandbox captures exit code, truncates output, and redacts secret env values', async () => {
  const oldPath = process.env.PATH;
  const binDir = path.join(os.tmpdir(), `infra-docker-fake-${Date.now()}`);
  await mkdir(binDir, { recursive: true });
  const dockerPath = path.join(binDir, 'docker');
  await writeFile(
    dockerPath,
    [
      '#!/bin/sh',
      'printf "stdout:%s:%s" "secret-token" "$*"',
      'printf "stderr:%s:%s" "secret-token" "$*" 1>&2',
      'exit 7',
      '',
    ].join('\n'),
  );
  await chmod(dockerPath, 0o755);

  try {
    process.env.PATH = `${binDir}:${oldPath ?? ''}`;
    const result = await runSandbox(baseOptions, 80);
    assert.equal(result.exitCode, 7);
    assert.equal(result.stdout.includes('secret-token'), false);
    assert.equal(result.stderr.includes('secret-token'), false);
    assert.match(result.stdout, /\*\*\*/);
    assert.match(result.stderr, /\*\*\*/);
    assert.ok(result.stdout.length <= 80);
    assert.ok(result.stderr.length <= 80);
    assert.equal(result.sandboxProfile.network, 'deny');
  } finally {
    process.env.PATH = oldPath;
  }
});
