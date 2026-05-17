#!/bin/bash
# Publish a single infra package with automatic version bump, build, and publish.
#
# Usage: bash scripts/publish-single.sh <package> [options]
#
# Arguments:
#   <package>         Package directory name (e.g., sso-browser, contracts, jwt)
#
# Options:
#   --patch           Bump patch version (default)
#   --minor           Bump minor version
#   --major           Bump major version
#   --version=X.Y.Z   Set exact version
#   --otp=<code>      NPM 2FA one-time password
#   --dry-run         Preview without publishing
#   --no-commit       Don't create git commit (useful for CI)
#
# Examples:
#   bash scripts/publish-single.sh sso-browser           # bump patch
#   bash scripts/publish-single.sh sso-browser --minor   # bump minor
#   bash scripts/publish-single.sh sso-browser --major   # bump major
#   bash scripts/publish-single.sh sso-browser --version=1.0.0
#   bash scripts/publish-single.sh sso-browser --otp=123456
#   bash scripts/publish-single.sh sso-browser --dry-run

set -e
cd "$(dirname "$0")/.."

# ──────────────────────────────────────────────────────────────────────
# Parse arguments
# ──────────────────────────────────────────────────────────────────────
if [ $# -eq 0 ]; then
  echo "Error: Package name required."
  echo "Usage: bash scripts/publish-single.sh <package> [options]"
  echo ""
  echo "Available packages:"
  ls -d packages/*/ | xargs -n1 basename | sort | while read pkg; do
    pkg_name=$(node -e "console.log(require('./packages/$pkg/package.json').name)" 2>/dev/null || echo "?")
    printf "  %-20s -> %s\n" "$pkg" "$pkg_name"
  done
  exit 1
fi

PACKAGE="$1"
shift

# Validate package exists
if [ ! -d "packages/$PACKAGE" ]; then
  echo "Error: Package '$PACKAGE' not found in packages/ directory."
  echo "Available packages:"
  ls -d packages/*/ | xargs -n1 basename
  exit 1
fi

BUMP_TYPE="patch"
EXACT_VERSION=""
OTP_FLAG=""
DRY_RUN=false
NO_COMMIT=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --patch)    BUMP_TYPE="patch"; shift ;;
    --minor)    BUMP_TYPE="minor"; shift ;;
    --major)    BUMP_TYPE="major"; shift ;;
    --version=*) EXACT_VERSION="${1#*=}"; shift ;;
    --otp=*)    OTP_FLAG="--otp=${1#*=}"; shift ;;
    --dry-run)  DRY_RUN=true; shift ;;
    --no-commit) NO_COMMIT=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ──────────────────────────────────────────────────────────────────────
# Get package info
# ──────────────────────────────────────────────────────────────────────
PKG_JSON="packages/$PACKAGE/package.json"
PKG_NAME=$(node -e "console.log(require('./$PKG_JSON').name)")
CURRENT_VERSION=$(node -e "console.log(require('./$PKG_JSON').version)")

echo "Package: $PKG_NAME"
echo "Current version: $CURRENT_VERSION"
echo ""

# ──────────────────────────────────────────────────────────────────────
# Determine new version
# ──────────────────────────────────────────────────────────────────────
if [ -n "$EXACT_VERSION" ]; then
  NEW_VERSION="$EXACT_VERSION"
else
  IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
  case "$BUMP_TYPE" in
    major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
    minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
    patch) PATCH=$((PATCH + 1)) ;;
  esac
  NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
fi

if [ "$NEW_VERSION" = "$CURRENT_VERSION" ]; then
  echo "Error: New version ($NEW_VERSION) is the same as current version. Nothing to bump."
  exit 1
fi

echo "Bumping version: $CURRENT_VERSION → $NEW_VERSION"
echo ""

# ──────────────────────────────────────────────────────────────────────
# Pre-flight checks (only if committing)
# ──────────────────────────────────────────────────────────────────────
if [ "$NO_COMMIT" = false ]; then
  # Check working tree is clean
  if [ -n "$(git status --porcelain)" ]; then
    echo "Error: Working tree is not clean. Please commit or stash changes first."
    git status --short
    exit 1
  fi

  # Ensure we're on main (or warn)
  BRANCH=$(git branch --show-current)
  if [ "$BRANCH" != "main" ]; then
    echo "Warning: You are on branch '$BRANCH', not 'main'."
    read -rp "Continue anyway? [y/N] " yn
    case "$yn" in
      [yY]*) ;;
      *) echo "Aborted."; exit 1 ;;
    esac
  fi
fi

# ──────────────────────────────────────────────────────────────────────
# Dry run preview
# ──────────────────────────────────────────────────────────────────────
if $DRY_RUN; then
  echo "=== DRY RUN - would bump $PKG_NAME to $NEW_VERSION ==="
  echo ""
  echo "Would perform:"
  echo "  1. Bump version in $PKG_JSON"
  echo "  2. Build package $PACKAGE"
  if [ "$NO_COMMIT" = false ]; then
    echo "  3. Create git commit: 'chore($PACKAGE): bump to $NEW_VERSION'"
    echo "  4. Create git tag: '$PACKAGE-v$NEW_VERSION'"
  fi
  echo "  5. Publish to npm"
  exit 0
fi

# ──────────────────────────────────────────────────────────────────────
# Bump version in package.json
# ──────────────────────────────────────────────────────────────────────
echo "Bumping version in $PKG_JSON..."
node -e "
  const pkg = require('./$PKG_JSON');
  pkg.version = '$NEW_VERSION';
  require('fs').writeFileSync('$PKG_JSON', JSON.stringify(pkg, null, 2) + '\n');
"
echo "  Version bumped to $NEW_VERSION."
echo ""

# ──────────────────────────────────────────────────────────────────────
# Build the specific package
# ──────────────────────────────────────────────────────────────────────
echo "Building package $PACKAGE..."

# Check if package has a build script
HAS_BUILD=$(node -e "console.log(require('./$PKG_JSON').scripts?.build ? 'yes' : 'no')")
if [ "$HAS_BUILD" = "yes" ]; then
  cd "packages/$PACKAGE"
  pnpm run build
  cd -
else
  echo "  No build script found, skipping build."
fi
echo ""

# ──────────────────────────────────────────────────────────────────────
# Commit & tag (if not --no-commit)
# ──────────────────────────────────────────────────────────────────────
if [ "$NO_COMMIT" = false ]; then
  echo "Committing version bump..."
  git add "$PKG_JSON"
  git commit -m "chore($PACKAGE): bump to ${NEW_VERSION}"

  echo "Creating tag ${PACKAGE}-v${NEW_VERSION}..."
  git tag "${PACKAGE}-v${NEW_VERSION}"
  echo ""
fi

# ──────────────────────────────────────────────────────────────────────
# Publish
# ──────────────────────────────────────────────────────────────────────
# Note: pnpm automatically converts workspace:* to actual version during publish

echo "=== Publishing $PKG_NAME ==="
cd "packages/$PACKAGE"

PUBLISH_ARGS=(--access public --no-git-checks)
if [ -n "$OTP_FLAG" ]; then
  PUBLISH_ARGS+=("$OTP_FLAG")
fi

pnpm publish "${PUBLISH_ARGS[@]}" || {
  echo ""
  echo "Publish failed. Restoring package.json..."
  cd -
  git checkout -- "$PKG_JSON"
  exit 1
}

cd -
echo ""
echo "Done. Published $PKG_NAME @ ${NEW_VERSION}."