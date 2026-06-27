import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import {
  buildDockerVolumeArg,
  findWorkspaceRoot,
  interpolatePathTemplate,
  isSameOrChildPath,
  resolveAllowedTargetPath,
  resolveConfiguredRoots,
} from '../dist/index.js';

test('isSameOrChildPath accepts exact paths and descendants only', () => {
  const root = path.join(os.tmpdir(), 'infra-workspace-root');

  assert.equal(isSameOrChildPath(root, root), true);
  assert.equal(isSameOrChildPath(root, path.join(root, 'child')), true);
  assert.equal(isSameOrChildPath(root, `${root}-sibling`), false);
});

test('resolveAllowedTargetPath validates allowed absolute directories', async () => {
  const root = path.join(os.tmpdir(), `infra-workspace-${Date.now()}`);
  await mkdir(root, { recursive: true });
  const child = path.join(root, 'repo');
  await mkdir(child);

  await assert.rejects(
    () =>
      resolveAllowedTargetPath({
        input: 'relative/path',
        allowedRoots: [root],
      }),
    /absolute path/,
  );
  assert.equal(
    await resolveAllowedTargetPath({
      input: child,
      allowedRoots: [root],
      directoryOnly: true,
    }),
    child,
  );
});

test('findWorkspaceRoot and configured roots support monorepo markers', async () => {
  const root = path.join(os.tmpdir(), `infra-workspace-marker-${Date.now()}`);
  const nested = path.join(root, 'apps', 'api');
  await mkdir(nested, { recursive: true });
  await writeFile(path.join(root, 'pnpm-workspace.yaml'), 'packages: []\n');

  assert.equal(findWorkspaceRoot({ startDir: nested }), root);
  assert.deepEqual(resolveConfiguredRoots('', root), [root]);
});

test('path templates and Docker volume args are deterministic', () => {
  assert.equal(
    interpolatePathTemplate('/workspace/{scopeId}/{agentId}', {
      scopeId: 'team-1',
      agentId: 'bot-1',
    }),
    '/workspace/team-1/bot-1',
  );
  assert.equal(
    buildDockerVolumeArg({
      hostPath: '/workspace/agents/bot-1',
      containerPath: '/app/workspace',
      access: 'ro',
    }),
    '/workspace/agents/bot-1:/app/workspace:ro',
  );
});
