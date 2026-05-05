#!/bin/bash
# Build all infra packages from a single tsc compilation.
# This handles circular dependencies between packages (e.g. common ↔ redis).
#
# Usage: cd infra.dofe.ai && bash scripts/build-all.sh

set -e
cd "$(dirname "$0")/.."

echo "Building all infra packages..."
rm -rf _dist_tmp

npx tsc -p tsconfig.build-all.json

echo "Distributing output to each package's dist/..."
for pkg in _dist_tmp/*/; do
  name=$(basename "$pkg")
  rm -rf "packages/$name/dist"
  cp -r "$pkg/src" "packages/$name/dist"
  echo "  $name → packages/$name/dist/"
done

rm -rf _dist_tmp

# Copy i18n locale JSON files to dist/ (not compiled by tsc)
echo "Copying i18n locale resources..."
cp -r packages/i18n/src/en packages/i18n/dist/en 2>/dev/null || true
cp -r packages/i18n/src/zh-CN packages/i18n/dist/zh-CN 2>/dev/null || true

# Generate explicit exports for each package (Node.js v25 CJS compat)
echo "Generating exports..."
for pkg in packages/*/; do
  name=$(basename "$pkg")
  (cd "$pkg" && node ../../scripts/generate-exports.mjs)
done

echo "Done. All packages built successfully."
