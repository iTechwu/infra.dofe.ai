/**
 * Post-build script that scans dist/ and generates explicit per-module
 * exports in package.json.  Node.js v25 CJS exports resolution does NOT
 * support array fallback in the "default" condition, so every exportable
 * module must be listed with a single, correct path pattern.
 *
 * Usage (from package dir):  node ../../scripts/generate-exports.mjs
 */

import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const pkgDir = process.argv[2] ? join(process.cwd(), process.argv[2]) : process.cwd();
const pkgJsonPath = join(pkgDir, 'package.json');
const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
const distDir = join(pkgDir, 'dist');

if (!existsSync(distDir)) {
  console.error('dist/ directory not found — run build first');
  process.exit(1);
}

/**
 * Walk dist/ recursively. For each .js file:
 * - index.js → export key is parent dir name, path is dir/index.js
 * - other.js → export key is the file path without .js, path follows same shape
 *
 * The stripPrefix param removes a leading path segment from export keys
 * (e.g. clients package has dist/internal/ but exports omit "internal").
 */
function generateExports(stripPrefix = '') {
  const exports = {};

  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      if (
        entry.endsWith('.js.map') ||
        entry.endsWith('.d.ts.map') ||
        entry.endsWith('.d.ts')
      )
        continue;

      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (entry.endsWith('.js')) {
        const rel = fullPath.slice(distDir.length + 1); // e.g. "internal/openai/index.js"
        const nameWithoutExt = rel.replace(/\.js$/, ''); // e.g. "internal/openai/index"

        if (entry === 'index.js') {
          const parentDir = dirname(nameWithoutExt); // e.g. "internal/openai", or "." for root
          let exportKey = parentDir === '.' ? '.' : './' + parentDir;

          if (stripPrefix && exportKey.startsWith('./' + stripPrefix + '/')) {
            exportKey = './' + exportKey.slice(('./' + stripPrefix + '/').length);
          } else if (stripPrefix && exportKey === './' + stripPrefix) {
            exportKey = '.';
          }

          const typePath = parentDir === '.'
            ? './dist/index.d.ts'
            : './dist/' + parentDir + '/index.d.ts';
          const defaultPath = parentDir === '.'
            ? './dist/index.js'
            : './dist/' + parentDir + '/index.js';

          exports[exportKey] = { types: typePath, default: defaultPath };
        } else {
          let exportKey = './' + nameWithoutExt;

          if (stripPrefix && exportKey.startsWith('./' + stripPrefix + '/')) {
            exportKey = './' + exportKey.slice(('./' + stripPrefix + '/').length);
          }

          exports[exportKey] = {
            types: './dist/' + nameWithoutExt + '.d.ts',
            default: './dist/' + nameWithoutExt + '.js',
          };
        }
      }
    }
  }

  walk(distDir);
  return exports;
}

// Clients package has modules under dist/internal/ but exported at top level
const stripPrefix = existsSync(join(distDir, 'internal')) ? 'internal' : '';

const exports = generateExports(stripPrefix);

// Sort keys for stable, readable output
const sorted = {};
for (const key of Object.keys(exports).sort()) {
  sorted[key] = exports[key];
}

pkg.exports = sorted;
writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n');

const count = Object.keys(sorted).length;
console.log(`[generate-exports] ${pkg.name}: ${count} export${count !== 1 ? 's' : ''} written`);
