#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const featureRegistryPath = resolve(
  root,
  'packages/common/src/config/features/feature-registry.ts',
);
const yamlValidationPath = resolve(
  root,
  'packages/common/src/config/validation/yaml.validation.ts',
);

const featureRegistry = readFileSync(featureRegistryPath, 'utf8');
const yamlValidation = readFileSync(yamlValidationPath, 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`storage boundary check failed: ${message}`);
    process.exitCode = 1;
  }
}

const storageFeatureBlock = featureRegistry.match(
  /storage:\s*\{[\s\S]*?\n\s*\},\n\s*'storage-client':/,
)?.[0];
const storageClientFeatureBlock = featureRegistry.match(
  /'storage-client':\s*\{[\s\S]*?\n\s*\},\n\s*\/\/ ── AI/,
)?.[0];

assert(storageFeatureBlock, 'storage feature block not found');
assert(storageClientFeatureBlock, 'storage-client feature block not found');

if (storageFeatureBlock) {
  assert(
    !storageFeatureBlock.includes('requiredYamlPaths'),
    'storage feature must not require yaml paths',
  );
  assert(
    !storageFeatureBlock.includes('buckets'),
    'storage feature must not require buckets',
  );
}

if (storageClientFeatureBlock) {
  assert(
    storageClientFeatureBlock.includes("requiredYamlPaths: ['buckets']"),
    'storage-client feature must require buckets',
  );
  assert(
    storageClientFeatureBlock.includes("requiredKeysPaths: ['storage']"),
    'storage-client feature must require storage keys',
  );
}

for (const field of [
  'defaultPrivateBucket',
  'defaultPublicBucket',
  'transcodeBucket',
]) {
  const pattern = new RegExp(`${field}:\\s*z\\.string\\(\\)\\.min\\(1\\)\\.optional\\(\\)`);
  assert(pattern.test(yamlValidation), `${field} must be optional in zoneSchema`);
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (['node_modules', 'dist', 'coverage'].includes(entry)) {
      continue;
    }

    const path = resolve(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      yield* walk(path);
    } else if (/\.(ts|mts|cts|js|mjs|cjs)$/.test(entry)) {
      yield path;
    }
  }
}

const directBucketConfigPattern =
  /getOrThrow(?:<[^>\n]*>)?\s*\(\s*['"`]buckets['"`]/;
for (const path of walk(resolve(root, 'packages'))) {
  const content = readFileSync(path, 'utf8');
  assert(
    !directBucketConfigPattern.test(content),
    `direct getOrThrow('buckets') is not allowed; use storage-client guard in ${path}`,
  );
}

if (!process.exitCode) {
  console.log('storage boundary check passed');
}
