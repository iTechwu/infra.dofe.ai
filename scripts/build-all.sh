#!/bin/bash
# ============================================================================
# Build all infra packages from a single tsc compilation.
#
# WHY single-pass: This handles circular dependencies between packages
# (e.g. common ↔ redis) that would break sequential builds.
#
# This script IS the build contract for this monorepo. Do not build individual
# packages with `tsc -p packages/<name>/tsconfig.json` unless you understand
# the circular dependency implications.
#
# Steps:
#   1. Clean _dist_tmp
#   2. Single tsc compilation → _dist_tmp/
#   3. Distribute output to each package's dist/
#   4. Clean _dist_tmp
#   5. Copy i18n locale resources
#   6. Generate package.json exports for CJS compat
#
# Usage: cd infra.dofe.ai && bash scripts/build-all.sh
# ============================================================================

set -euo pipefail
cd "$(dirname "$0")/.."

# ---------------------------------------------------------------------------
# Step 1: Clean temporary output
# ---------------------------------------------------------------------------
echo "=== Step 1/6: Cleaning temporary build output ==="
rm -rf _dist_tmp

# ---------------------------------------------------------------------------
# Step 2: Single-pass TypeScript compilation
# ---------------------------------------------------------------------------
echo "=== Step 2/6: Compiling all packages with tsconfig.build-all.json ==="
npx tsc -p tsconfig.build-all.json

# Validate that compilation produced output
if [ ! -d "_dist_tmp" ]; then
  echo "ERROR: _dist_tmp/ not created after tsc compilation. Build failed."
  exit 1
fi

DIST_COUNT=$(find _dist_tmp -maxdepth 1 -mindepth 1 -type d | wc -l | tr -d ' ')
if [ "$DIST_COUNT" -lt 5 ]; then
  echo "ERROR: Only $DIST_COUNT package directories found in _dist_tmp/. Expected at least 5."
  echo "Check tsconfig.build-all.json for path configuration errors."
  exit 1
fi
echo "  $DIST_COUNT packages compiled."

# ---------------------------------------------------------------------------
# Step 3: Distribute output to each package's dist/
# ---------------------------------------------------------------------------
echo "=== Step 3/6: Distributing output to package dist/ directories ==="
for pkg in _dist_tmp/*/; do
  name=$(basename "$pkg")
  rm -rf "packages/$name/dist"
  cp -r "$pkg/src" "packages/$name/dist"
  echo "  $name → packages/$name/dist/"
done

# ---------------------------------------------------------------------------
# Step 4: Clean temporary output
# ---------------------------------------------------------------------------
echo "=== Step 4/6: Cleaning temporary build output ==="
rm -rf _dist_tmp

# ---------------------------------------------------------------------------
# Step 5: Copy i18n locale resources
# ---------------------------------------------------------------------------
echo "=== Step 5/6: Copying i18n locale resources ==="
# i18n JSON files are not compiled by tsc, must be copied manually
if [ -d "packages/i18n/src/en" ]; then
  cp -r packages/i18n/src/en packages/i18n/dist/en
  echo "  en → packages/i18n/dist/en/"
else
  echo "  WARNING: packages/i18n/src/en/ not found, skipping"
fi

if [ -d "packages/i18n/src/zh-CN" ]; then
  cp -r packages/i18n/src/zh-CN packages/i18n/dist/zh-CN
  echo "  zh-CN → packages/i18n/dist/zh-CN/"
else
  echo "  WARNING: packages/i18n/src/zh-CN/ not found, skipping"
fi

# ---------------------------------------------------------------------------
# Step 6: Generate package.json exports
# ---------------------------------------------------------------------------
echo "=== Step 6/6: Generating package.json exports ==="
ESSENTIAL_PACKAGES="common clients utils prisma shared-services contracts docker rabbitmq redis jwt shared-db vector"
FAILED_EXPORTS=""

for pkg in packages/*/; do
  name=$(basename "$pkg")
  if [ -d "$pkg/dist" ]; then
    if ! (cd "$pkg" && node ../../scripts/generate-exports.mjs); then
      echo "  ERROR: generate-exports failed for @dofe/infra-$name"
      FAILED_EXPORTS="$FAILED_EXPORTS $name"
    fi
  else
    echo "  [generate-exports] @dofe/infra-$name: no dist/ — skipping (config-only package)"
  fi
done

# ---------------------------------------------------------------------------
# Post-build verification
# ---------------------------------------------------------------------------
echo ""
echo "=== Post-build verification ==="
MISSING_DIST=""
for pkg in $ESSENTIAL_PACKAGES; do
  if [ ! -d "packages/$pkg/dist" ]; then
    echo "  ERROR: Essential package '$pkg' has no dist/ directory!"
    MISSING_DIST="$MISSING_DIST $pkg"
  fi
done

if [ -n "$MISSING_DIST" ]; then
  echo ""
  echo "BUILD FAILED: Essential packages missing dist/ output:$MISSING_DIST"
  echo "Check the compilation output above for TypeScript errors."
  exit 1
fi

if [ -n "$FAILED_EXPORTS" ]; then
  echo ""
  echo "BUILD FAILED: generate-exports.mjs failed for:$FAILED_EXPORTS"
  exit 1
fi

echo "Done. All packages built successfully."
