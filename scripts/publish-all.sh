#!/bin/bash
# Publish all infra packages with automatic version bump, changelog, build, and commit.
#
# Usage: bash scripts/publish-all.sh [options]
#
# Options:
#   --patch          Bump patch version (default)
#   --minor          Bump minor version
#   --major          Bump major version
#   --version=X.Y.Z  Set exact version
#   --otp=<code>     NPM 2FA one-time password
#   --dry-run        Preview without publishing
#
# Examples:
#   bash scripts/publish-all.sh                     # bump patch
#   bash scripts/publish-all.sh --minor             # bump minor
#   bash scripts/publish-all.sh --major             # bump major
#   bash scripts/publish-all.sh --version=1.0.0     # set exact version
#   bash scripts/publish-all.sh --otp=123456        # with 2FA

set -e
cd "$(dirname "$0")/.."

# ──────────────────────────────────────────────────────────────────────
# Parse flags
# ──────────────────────────────────────────────────────────────────────
BUMP_TYPE="patch"
EXACT_VERSION=""
OTP_FLAG=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --patch)    BUMP_TYPE="patch"; shift ;;
    --minor)    BUMP_TYPE="minor"; shift ;;
    --major)    BUMP_TYPE="major"; shift ;;
    --version=*) EXACT_VERSION="${1#*=}"; shift ;;
    --otp=*)    OTP_FLAG="--otp=${1#*=}"; shift ;;
    --dry-run)  DRY_RUN=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ──────────────────────────────────────────────────────────────────────
# Pre-flight checks
# ──────────────────────────────────────────────────────────────────────

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

# ──────────────────────────────────────────────────────────────────────
# Determine current and new version
# ──────────────────────────────────────────────────────────────────────
CURRENT_VERSION=$(node -e "console.log(require('./packages/contracts/package.json').version)")

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
# Generate changelog entry from commits since last tag
# ──────────────────────────────────────────────────────────────────────
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
TODAY=$(date +%Y-%m-%d)

if [ -n "$LAST_TAG" ]; then
  echo "Generating changelog from commits since $LAST_TAG..."
  RANGE="${LAST_TAG}..HEAD"
else
  echo "Generating changelog from all commits..."
  RANGE="HEAD"
fi

# Collect conventional commits grouped by type.
# We format as "- %s" (subject only) then filter with grep to avoid false
# matches from the commit body that --grep would catch.
ALL_COMMITS=$(git log "$RANGE" --no-merges --format='- %s' 2>/dev/null || true)

FEAT_COMMITS=$(echo "$ALL_COMMITS" | grep -E '^- feat(\(|:)' | sed 's/^- feat\(([^)]*)\)\?: /- /' || true)
FIX_COMMITS=$(echo "$ALL_COMMITS" | grep -E '^- fix(\(|:)' | sed 's/^- fix\(([^)]*)\)\?: /- /' || true)
REFACTOR_COMMITS=$(echo "$ALL_COMMITS" | grep -E '^- refactor(\(|:)' | sed 's/^- refactor\(([^)]*)\)\?: /- /' || true)
CHORE_COMMITS=$(echo "$ALL_COMMITS" | grep -E '^- chore(\(|:)' | sed 's/^- chore\(([^)]*)\)\?: /- /' || true)
OTHER_COMMITS=$(echo "$ALL_COMMITS" | grep -vE '^- (feat|fix|refactor|chore)\(|^- (feat|fix|refactor|chore):' || true)

# Build the new changelog section
CHANGELOG_ENTRY="## [${NEW_VERSION}] - ${TODAY}"

append_section() {
  local commits="$1"
  if [ -n "$commits" ]; then
    CHANGELOG_ENTRY+=$'\n'"$commits"
  fi
}

append_section "$FEAT_COMMITS"
append_section "$FIX_COMMITS"
append_section "$REFACTOR_COMMITS"
append_section "$CHORE_COMMITS"
append_section "$OTHER_COMMITS"

# Prepend to CHANGELOG.md
if [ -f CHANGELOG.md ]; then
  printf '%s\n\n%s\n' "$CHANGELOG_ENTRY" "$(cat CHANGELOG.md)" > CHANGELOG.md
else
  printf '%s\n\n' "$CHANGELOG_ENTRY" > CHANGELOG.md
fi

echo "Changelog updated."
echo ""

if $DRY_RUN; then
  echo "=== DRY RUN - would bump to $NEW_VERSION ==="
  echo "$CHANGELOG_ENTRY"
  echo ""
  echo "Restoring CHANGELOG.md (dry run)..."
  git checkout -- CHANGELOG.md
  exit 0
fi

# ──────────────────────────────────────────────────────────────────────
# Bump version in all package.json files
# ──────────────────────────────────────────────────────────────────────
echo "Bumping version in all package.json files..."
for pkg_json in packages/*/package.json; do
  node -e "
    const pkg = require('./$pkg_json');
    pkg.version = '$NEW_VERSION';
    require('fs').writeFileSync('$pkg_json', JSON.stringify(pkg, null, 2) + '\n');
  "
done
echo "  All packages bumped to $NEW_VERSION."
echo ""

# ──────────────────────────────────────────────────────────────────────
# Build
# ──────────────────────────────────────────────────────────────────────
echo "Building all packages..."
bash scripts/build-all.sh
echo ""

# ──────────────────────────────────────────────────────────────────────
# Commit & tag
# ──────────────────────────────────────────────────────────────────────
echo "Committing version bump and changelog..."
git add packages/*/package.json CHANGELOG.md
git commit -m "chore: bump all packages to ${NEW_VERSION}"

echo "Creating tag v${NEW_VERSION}..."
git tag "v${NEW_VERSION}"

echo ""

# ──────────────────────────────────────────────────────────────────────
# Publish
# ──────────────────────────────────────────────────────────────────────
echo "=== Replacing workspace:* with ^${NEW_VERSION} for publish ==="
for pkg_json in packages/*/package.json; do
  if grep -q 'workspace:\*' "$pkg_json" 2>/dev/null; then
    sed -i '' 's/"workspace:\*"/"^'"$NEW_VERSION"'"/g' "$pkg_json"
    echo "  Updated: $pkg_json"
  fi
done

echo ""
echo "=== Publishing ==="
PUBLISH_ARGS=(-r --access public --no-git-checks)
if [ -n "$OTP_FLAG" ]; then
  PUBLISH_ARGS+=("$OTP_FLAG")
fi
pnpm publish "${PUBLISH_ARGS[@]}" || true

# ──────────────────────────────────────────────────────────────────────
# Restore package.json files (keep workspace:* in repo)
# ──────────────────────────────────────────────────────────────────────
echo ""
echo "=== Restoring package.json files ==="
git checkout -- packages/*/package.json

echo ""
echo "Done. Published ${NEW_VERSION}."
