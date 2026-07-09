#!/usr/bin/env node

/**
 * Smoke test selected package self-reference exports after a local build.
 *
 * This intentionally creates require() from each package directory so the
 * resolution path mirrors how Node consumes the package's own "exports" map.
 *
 * Usage:
 *   node scripts/verify-package-exports.mjs
 *   node scripts/verify-package-exports.mjs @dofe/infra-shared-services/volcengine-speech
 *   node scripts/verify-package-exports.mjs @dofe/infra-shared-services/volcengine-speech:resolve
 */

import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packagesRoot = join(repoRoot, 'packages');

const packageDirs = new Map();
for (const dirName of readdirSync(packagesRoot).sort()) {
  const packageJsonPath = join(packagesRoot, dirName, 'package.json');
  if (!existsSync(packageJsonPath)) continue;

  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  packageDirs.set(pkg.name, dirname(packageJsonPath));
}

const defaultChecks = [
  { spec: '@dofe/infra-shared-services/volcengine-speech', mode: 'resolve' },
  { spec: '@dofe/infra-shared-services/volcengine-speech/asr', mode: 'resolve' },
  { spec: '@dofe/infra-shared-services/volcengine-speech/audio-generation', mode: 'resolve' },
  { spec: '@dofe/infra-shared-services/volcengine-speech/tts-streaming', mode: 'resolve' },
  { spec: '@dofe/infra-shared-services/volcengine-speech/voice', mode: 'resolve' },
  { spec: '@dofe/infra-shared-services/volcengine-speech/realtime', mode: 'resolve' },
  { spec: '@dofe/infra-shared-services/volcengine-speech/podcast', mode: 'resolve' },
  { spec: '@dofe/infra-shared-services/volcengine-speech/interpretation', mode: 'resolve' },
  { spec: '@dofe/infra-shared-services/volcengine-speech/streaming-asr', mode: 'resolve' },
  { spec: '@dofe/infra-shared-services/volcengine-speech/memo', mode: 'resolve' },
  { spec: '@dofe/infra-shared-services/volcengine-speech/protocol', mode: 'require' },
  { spec: '@dofe/infra-shared-services/volcengine-speech/errors', mode: 'require' },
  { spec: '@dofe/infra-shared-services/volcengine-speech/task-result', mode: 'require' },
  { spec: '@dofe/infra-shared-services/volcengine-tts', mode: 'resolve' },
  { spec: '@dofe/infra-shared-services/volcengine-tts/tts-http-request', mode: 'require' },
  { spec: '@dofe/infra-shared-services/volcengine-tts/tts-stream-processor', mode: 'require' },
  { spec: '@dofe/infra-shared-services/volcengine-tts/tts-stream-result', mode: 'require' },
  { spec: '@dofe/infra-clients/sso', mode: 'resolve' },
  { spec: '@dofe/infra-common/ts-rest', mode: 'resolve' },
];

const args = process.argv.slice(2);
if (args.includes('--list-defaults')) {
  for (const check of defaultChecks) {
    console.log(`${check.spec}:${check.mode}`);
  }
  process.exit(0);
}

const specs = args.filter((arg) => arg !== '--');
const checksToVerify = specs.length > 0 ? specs.map(parseCheckArg) : defaultChecks;

for (const check of checksToVerify) {
  verifySpec(check);
}

console.log(`OK verified ${checksToVerify.length} package export${checksToVerify.length === 1 ? '' : 's'}`);

function verifySpec({ spec, mode }) {
  const packageName = parsePackageName(spec);
  const packageDir = packageDirs.get(packageName);
  if (!packageDir) {
    throw new Error(`Unknown workspace package for spec "${spec}"`);
  }

  const packageJsonPath = join(packageDir, 'package.json');
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const exportKey = spec === packageName ? '.' : `.${spec.slice(packageName.length)}`;

  if (!pkg.exports || !Object.hasOwn(pkg.exports, exportKey)) {
    throw new Error(`${spec} is missing from ${packageName} exports`);
  }

  const target = pkg.exports[exportKey];
  const defaultPath = typeof target === 'string' ? target : target.default;
  if (!defaultPath || !existsSync(join(packageDir, defaultPath))) {
    throw new Error(`${spec} points to missing default export file: ${defaultPath ?? '<none>'}`);
  }

  const requireFromPackage = createRequire(packageJsonPath);
  requireFromPackage.resolve(spec);

  if (mode === 'require') {
    requireFromPackage(spec);
  }

  console.log(`OK ${spec} (${mode})`);
}

function parsePackageName(spec) {
  if (!spec.startsWith('@')) {
    return spec.split('/')[0];
  }

  const [scope, name] = spec.split('/');
  if (!scope || !name) {
    throw new Error(`Invalid package spec "${spec}"`);
  }
  return `${scope}/${name}`;
}

function parseCheckArg(raw) {
  const modeDelimiter = raw.lastIndexOf(':');
  if (modeDelimiter > raw.lastIndexOf('/')) {
    const spec = raw.slice(0, modeDelimiter);
    const mode = raw.slice(modeDelimiter + 1);
    if (mode !== 'resolve' && mode !== 'require') {
      throw new Error(`Invalid verify mode "${mode}" for "${raw}"`);
    }
    return { spec, mode };
  }

  return { spec: raw, mode: 'require' };
}
