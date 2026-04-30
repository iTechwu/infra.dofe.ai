#!/bin/bash
# Publish all infra packages with workspace protocol resolution.
# This script temporarily replaces `workspace:*` with actual version numbers
# before publishing, then restores via git checkout.
#
# Usage: bash scripts/publish-all.sh [--otp=<code>]

set -e
cd "$(dirname "$0")/.."

# Check working tree is clean
if [ -n "$(git status --porcelain -- packages/*/package.json)" ]; then
  echo "Error: package.json files have uncommitted changes. Please commit or stash them first."
  exit 1
fi

# Determine the version to use (all packages share the same version)
VERSION=$(node -e "console.log(require('./packages/contracts/package.json').version)")
echo "=== Current version: $VERSION ==="

# Step 1: Replace workspace:* with ^version in all package.json files
echo ""
echo "=== Replacing workspace:* with ^${VERSION} ==="
for pkg_json in packages/*/package.json; do
  if grep -q 'workspace:\*' "$pkg_json"; then
    sed -i '' 's/"workspace:\*"/"^'"$VERSION"'"/g' "$pkg_json"
    echo "  Updated: $pkg_json"
  fi
done

# Step 2: Publish
echo ""
echo "=== Publishing ==="
pnpm publish -r --access public --no-git-checks || true

# Step 3: Restore original package.json files
echo ""
echo "=== Restoring package.json files ==="
git checkout -- packages/*/package.json

echo ""
echo "Done."
