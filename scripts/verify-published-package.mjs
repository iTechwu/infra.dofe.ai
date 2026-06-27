#!/usr/bin/env node

/**
 * Verify that a published package version is visible on npm and has a tarball.
 *
 * Usage:
 *   node scripts/verify-published-package.mjs @dofe/infra-docker 0.1.79
 *   node scripts/verify-published-package.mjs @dofe/infra-docker@0.1.79
 */

import { execFileSync } from 'node:child_process';

const input = process.argv[2];
const explicitVersion = process.argv[3];

if (!input) {
  console.error('Usage: node scripts/verify-published-package.mjs <package> [version]');
  console.error('   or: node scripts/verify-published-package.mjs <package>@<version>');
  process.exit(1);
}

const { name, version } = parsePackageSpec(input, explicitVersion);
const spec = version ? `${name}@${version}` : name;

const latestVersion = npmView(name, ['version']);
const visibleVersion = version ?? latestVersion;
const tarball = npmView(`${name}@${visibleVersion}`, ['dist.tarball']);

if (!tarball.startsWith('http')) {
  console.error(`Invalid dist.tarball for ${name}@${visibleVersion}: ${tarball}`);
  process.exit(1);
}

console.log(`OK ${name}@${visibleVersion}`);
console.log(`latest=${latestVersion}`);
console.log(`tarball=${tarball}`);

if (version && latestVersion !== version) {
  console.log(`note: latest npm version is ${latestVersion}; verified requested ${spec}`);
}

function npmView(packageSpec, fields) {
  try {
    return execFileSync('npm', ['view', packageSpec, ...fields], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    const stderr = error && typeof error === 'object' && 'stderr' in error
      ? String(error.stderr)
      : String(error);
    console.error(`npm view failed for ${packageSpec} ${fields.join('.')}`);
    console.error(stderr.trim());
    process.exit(1);
  }
}

function parsePackageSpec(raw, versionArg) {
  if (versionArg) return { name: raw, version: versionArg };

  const atIndex = raw.startsWith('@') ? raw.indexOf('@', 1) : raw.indexOf('@');
  if (atIndex > 0) {
    return {
      name: raw.slice(0, atIndex),
      version: raw.slice(atIndex + 1),
    };
  }

  return { name: raw, version: undefined };
}
