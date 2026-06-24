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
#   --otp=<code>     NPM 2FA one-time password. Can also be provided with
#                    NPM_CONFIG_OTP=<code>.
#   --dry-run        Preview without publishing
#   --publish-only   Skip bump/build/commit/tag — just publish current versions
#                    (useful after a failed publish to retry)
#
# Examples:
#   bash scripts/publish-all.sh                     # bump patch
#   bash scripts/publish-all.sh --minor             # bump minor
#   bash scripts/publish-all.sh --major             # bump major
#   bash scripts/publish-all.sh --version=1.0.0     # set exact version
#   bash scripts/publish-all.sh --otp=123456        # with 2FA
#   bash scripts/publish-all.sh --publish-only --otp=123456
#                                                     # retry after failed publish

set -e
cd "$(dirname "$0")/.."

# ──────────────────────────────────────────────────────────────────────
# Parse flags
# ──────────────────────────────────────────────────────────────────────
BUMP_TYPE="patch"
EXACT_VERSION=""
OTP_FLAG=""
DRY_RUN=false
PUBLISH_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --)              shift ;;
    --patch)         BUMP_TYPE="patch"; shift ;;
    --minor)         BUMP_TYPE="minor"; shift ;;
    --major)         BUMP_TYPE="major"; shift ;;
    --version=*)     EXACT_VERSION="${1#*=}"; shift ;;
    --otp=*)         OTP_FLAG="--otp=${1#*=}"; shift ;;
    --dry-run)       DRY_RUN=true; shift ;;
    --publish-only)  PUBLISH_ONLY=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [ -z "$OTP_FLAG" ] && [ -n "${NPM_CONFIG_OTP:-}" ]; then
  OTP_FLAG="--otp=${NPM_CONFIG_OTP}"
fi

# ──────────────────────────────────────────────────────────────────────
# Pre-flight checks
# ──────────────────────────────────────────────────────────────────────

# Check working tree is clean before creating a new release commit. Publish-only
# mode is used to resume a failed publish for the already-committed version.
if ! $PUBLISH_ONLY && [ -n "$(git status --porcelain)" ]; then
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

if $PUBLISH_ONLY; then
  NEW_VERSION="$CURRENT_VERSION"
  echo "Publish-only mode: using current version $NEW_VERSION"
  echo ""
else
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
fi

# ──────────────────────────────────────────────────────────────────────
# Publish
# ──────────────────────────────────────────────────────────────────────
# Note: pnpm automatically converts workspace:* to actual version during publish
# No need to manually replace workspace:* or restore package.json after publish
#
# We publish packages one-by-one instead of using `-r` so that a 403 on an
# already-published package doesn't block the remaining packages.  This also
# makes the script safe to re-run after a partial publish.

echo "=== Publishing ==="
if [ -z "$OTP_FLAG" ]; then
  echo "NOTE: No --otp flag provided. If your npm account has 2FA enabled for"
  echo "      writes, publish will fail with EOTP. Use --otp=<code> to provide"
  echo "      your authenticator one-time password, or enter a code if prompted."
  echo ""
fi
FAILED_PKGS=()
PUBLISHED_COUNT=0
SKIPPED_COUNT=0

publish_package() {
  local pkg_dir="$1"
  local publish_log="$2"
  local exit_code=0

  (cd "$pkg_dir" && pnpm publish --access public --no-git-checks $OTP_FLAG) > "$publish_log" 2>&1
  exit_code=$?

  return $exit_code
}

for pkg_json in packages/*/package.json; do
  pkg_dir=$(dirname "$pkg_json")
  pkg_name=$(node -e "console.log(require('./$pkg_json').name)")
  pkg_version=$(node -e "console.log(require('./$pkg_json').version)")
  npm_version=$(npm view "$pkg_name" version 2>/dev/null || echo "0.0.0")

  if [ "$npm_version" = "$pkg_version" ]; then
    echo "  SKIP $pkg_name@$pkg_version (already on npm)"
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
  else
    printf "  PUBLISH %s@%s ... " "$pkg_name" "$pkg_version"
    # Use a temp file + set +e to avoid two issues:
    # 1. set -e would kill the script immediately when $(...) contains a
    #    failing command, skipping the error-handling if-block entirely.
    # 2. pnpm/npm may write directly to /dev/tty, bypassing pipe capture.
    PUBLISH_LOG=$(mktemp)
    set +e
    publish_package "$pkg_dir" "$PUBLISH_LOG"
    PUBLISH_EXIT=$?
    set -e

    if [ $PUBLISH_EXIT -ne 0 ] && grep -qE 'npm error (code )?EOTP|npm error EOTP' "$PUBLISH_LOG"; then
      echo "EOTP"
      read -rsp "        Enter npm OTP to retry $pkg_name@$pkg_version: " OTP_CODE
      echo ""
      if [ -n "$OTP_CODE" ]; then
        OTP_FLAG="--otp=${OTP_CODE}"
        : > "$PUBLISH_LOG"
        printf "        RETRY ... "
        set +e
        publish_package "$pkg_dir" "$PUBLISH_LOG"
        PUBLISH_EXIT=$?
        set -e
      fi
    fi

    if [ $PUBLISH_EXIT -eq 0 ]; then
      echo "OK"
      PUBLISHED_COUNT=$((PUBLISHED_COUNT + 1))
    else
      echo "FAILED"
      # Show the relevant npm error lines
      grep -E 'npm error (code|EOTP|ENEEDAUTH|403|402|401)' "$PUBLISH_LOG" | sed 's/^/        /' || true
      FAILED_PKGS+=("$pkg_name@$pkg_version")
    fi
    rm -f "$PUBLISH_LOG"
  fi
done

echo ""
echo "Published: $PUBLISHED_COUNT  Skipped: $SKIPPED_COUNT  Failed: ${#FAILED_PKGS[@]}"
if [ ${#FAILED_PKGS[@]} -gt 0 ]; then
  echo "Failed packages:"
  for p in "${FAILED_PKGS[@]}"; do
    echo "  - $p"
  done
  exit 1
fi

echo ""
echo "Done. Published ${NEW_VERSION}."
