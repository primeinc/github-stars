#!/usr/bin/env bash
# ShellCheck repository scanner
# Deterministic, git-safe, mode-aware shell script linter

set -euo pipefail

# Usage information
usage() {
  cat << 'EOF'
Usage: shellcheck_repo.sh [OPTIONS]

Scan shell scripts in the repository using ShellCheck.

OPTIONS:
  --mode=all      Scan all tracked files in the repository (default)
  --mode=staged   Scan only staged files (git index content)
  --help          Show this help message

EXAMPLES:
  # Scan entire repository
  ./shellcheck_repo.sh --mode=all

  # Scan only staged files (for pre-commit hook)
  ./shellcheck_repo.sh --mode=staged

REQUIREMENTS:
  - ShellCheck must be installed
  - Must be run from within a git repository

INSTALL SHELLCHECK:
  Ubuntu/Debian: sudo apt-get install shellcheck
  macOS:         brew install shellcheck
  Windows:       choco install shellcheck
                 or: winget install koalaman.shellcheck
EOF
}

# Parse arguments
MODE="all"
for arg in "$@"; do
  case "$arg" in
    --mode=all)
      MODE="all"
      ;;
    --mode=staged)
      MODE="staged"
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Error: Unknown option: $arg" >&2
      usage >&2
      exit 1
      ;;
  esac
done

# Check if shellcheck is installed
if ! command -v shellcheck &> /dev/null; then
  cat >&2 << 'EOF'
Error: ShellCheck is not installed.

Please install ShellCheck:
  Ubuntu/Debian: sudo apt-get install shellcheck
  macOS:         brew install shellcheck
  Windows:       choco install shellcheck
                 or: winget install koalaman.shellcheck

For more information: https://github.com/koalaman/shellcheck#installing
EOF
  exit 1
fi

# Get repository root (works from any directory in repo)
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || true)
if [ -z "$REPO_ROOT" ]; then
  echo "Error: Not in a git repository" >&2
  exit 1
fi

cd "$REPO_ROOT"

# Paths to skip (junk directories)
SKIP_PATHS=(
  "node_modules/"
  "dist/"
  "build/"
  "vendor/"
)

# Check if path should be skipped
should_skip() {
  local path="$1"
  for skip in "${SKIP_PATHS[@]}"; do
    if [[ "$path" == "$skip"* ]]; then
      return 0
    fi
  done
  return 1
}

# Check if file has shell extension
has_shell_extension() {
  local path="$1"
  case "$path" in
    *.sh|*.bash|*.ksh)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

# Check if content has shell shebang (first line only)
has_shell_shebang() {
  local content="$1"
  local first_line
  # Use parameter expansion to get first line (avoids broken pipe with head)
  first_line="${content%%$'\n'*}"
  
  # Match shell shebangs
  case "$first_line" in
    "#!/bin/sh"|"#!/bin/bash"|"#!/bin/dash"|"#!/bin/ksh")
      return 0
      ;;
    "#!/usr/bin/env sh"|"#!/usr/bin/env bash"|"#!/usr/bin/env dash"|"#!/usr/bin/env ksh")
      return 0
      ;;
    "#!/usr/bin/env -S sh"|"#!/usr/bin/env -S bash"|"#!/usr/bin/env -S dash"|"#!/usr/bin/env -S ksh")
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

# Array to hold target files (deduplicated)
declare -A TARGET_FILES

echo "========================================"
echo "ShellCheck Repository Scanner"
echo "Mode: $MODE"
echo "========================================"

if [ "$MODE" = "all" ]; then
  # Mode: all - scan tracked files from working tree
  while IFS= read -r -d '' path; do
    # Skip junk paths
    if should_skip "$path"; then
      continue
    fi
    
    # Check extension
    if has_shell_extension "$path"; then
      TARGET_FILES["$path"]=1
      continue
    fi
    
    # Check shebang in working tree file
    if [ -f "$path" ]; then
      if has_shell_shebang "$(cat "$path")"; then
        TARGET_FILES["$path"]=1
      fi
    fi
  done < <(git ls-files -z)

elif [ "$MODE" = "staged" ]; then
  # Mode: staged - scan staged files from git index
  # Use --name-only to get just the new paths (handles renames/copies correctly)
  while IFS= read -r -d '' path; do
    # Skip junk paths
    if should_skip "$path"; then
      continue
    fi
    
    # Check extension
    if has_shell_extension "$path"; then
      TARGET_FILES["$path"]=1
      continue
    fi
    
    # Check shebang in staged blob
    staged_content=$(git show ":$path" 2>/dev/null || echo "")
    if [ -n "$staged_content" ]; then
      if has_shell_shebang "$staged_content"; then
        TARGET_FILES["$path"]=1
      fi
    fi
  done < <(git diff --cached --name-only -z --diff-filter=ACMR)
fi

# Get sorted list of target files (deterministic ordering)
TARGET_LIST=()
for path in "${!TARGET_FILES[@]}"; do
  TARGET_LIST+=("$path")
done
# Sort and deduplicate using mapfile (avoids SC2207)
mapfile -t TARGET_LIST < <(printf '%s\n' "${TARGET_LIST[@]}" | sort -u)

FILE_COUNT=${#TARGET_LIST[@]}

if [ "$FILE_COUNT" -eq 0 ]; then
  echo "No shell scripts found to check."
  echo "========================================"
  exit 0
fi

echo "Found $FILE_COUNT shell script(s) to check"
echo "========================================"
echo ""

# Run ShellCheck
EXIT_CODE=0

for path in "${TARGET_LIST[@]}"; do
  echo "Checking: $path"
  
  if [ "$MODE" = "staged" ]; then
    # Lint staged blob content via stdin
    if ! git show ":$path" | shellcheck -x --stdin-filename "$path" -; then
      EXIT_CODE=1
    fi
  else
    # Lint working tree file
    if ! shellcheck -x "$path"; then
      EXIT_CODE=1
    fi
  fi
done

echo ""
echo "========================================"
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "✅ All checks passed"
else
  echo "❌ ShellCheck found issues"
fi
echo "========================================"

exit "$EXIT_CODE"
