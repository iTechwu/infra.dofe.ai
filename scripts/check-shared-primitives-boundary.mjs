#!/usr/bin/env node

/**
 * Guard shared primitives from silently absorbing product-specific semantics.
 *
 * Historical docker compatibility code still contains Bot/OpenClaw/Gateway
 * names. Those files are allowlisted so new product terms in runtime,
 * workspace, redis, or unrelated docker files fail loudly.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const roots = [
  'packages/runtime',
  'packages/workspace',
  'packages/docker',
  'packages/redis',
];

const productPattern = /\b(Bot|OpenClaw|Loop|Gateway|Review|model-routing)\b/g;
const allowedFiles = new Set([
  'packages/docker/README.md',
  'packages/docker/src/docker-image.service.ts',
  'packages/docker/src/docker-orphan-cleaner.service.ts',
  'packages/docker/src/docker-stats.service.ts',
  'packages/docker/src/docker.service.ts',
  'packages/docker/src/types.ts',
  'packages/redis/README.md',
  'packages/runtime/README.md',
  'packages/workspace/README.md',
]);

const findings = [];
for (const root of roots) {
  const absoluteRoot = join(repoRoot, root);
  if (!existsSync(absoluteRoot)) continue;
  walk(absoluteRoot);
}

const unexpected = findings.filter((finding) => !allowedFiles.has(finding.file));
for (const finding of findings) {
  const status = allowedFiles.has(finding.file) ? 'allowed' : 'unexpected';
  console.log(`${status} ${finding.file}:${finding.line}: ${finding.matches.join(', ')}`);
}

if (unexpected.length > 0) {
  console.error('');
  console.error(`Shared primitives boundary check failed with ${unexpected.length} unexpected hit${unexpected.length === 1 ? '' : 's'}.`);
  process.exit(1);
}

console.log(`OK shared primitives boundary: ${findings.length} product-term hit${findings.length === 1 ? '' : 's'} are documented compatibility or boundary notes`);

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'dist' || entry.name === 'node_modules') continue;

    const absolutePath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(absolutePath);
      continue;
    }

    if (!/\.(md|ts)$/.test(entry.name)) continue;

    const file = relative(repoRoot, absolutePath);
    const lines = readFileSync(absolutePath, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      const matches = [...line.matchAll(productPattern)].map((match) => match[1]);
      if (matches.length === 0) return;
      findings.push({ file, line: index + 1, matches: [...new Set(matches)] });
    });
  }
}
