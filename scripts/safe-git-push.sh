#!/bin/bash
# Safe git push with exponential backoff and conflict detection
# Usage: ./safe-git-push.sh [branch_name]

set -eo pipefail

BRANCH="${1:-main}"
MAX_RETRIES=5

echo "=========================================="
echo "Safe Git Push to $BRANCH"
echo "=========================================="

# Create unique temporary log file once (outside loop) with trap for cleanup
PULL_LOG=$(mktemp)
trap 'rm -f "$PULL_LOG"' EXIT

for attempt in $(seq 1 $MAX_RETRIES); do
  echo "Attempt $attempt/$MAX_RETRIES..."
  
  # Pull with rebase (no autostash to avoid silent data loss)
  # pipefail ensures we detect git pull failures, not just tee failures
  if git pull --rebase origin "$BRANCH" 2>&1 | tee "$PULL_LOG"; then
    echo "✅ Pull successful"
  else
    # Case-insensitive conflict detection (git outputs "CONFLICT" in uppercase)
    if grep -qi "conflict" "$PULL_LOG"; then
      echo "❌ CONFLICT detected during rebase"
      echo "This should not happen in automated workflows!"
      git rebase --abort || true
      exit 1
    else
      echo "⚠️  Pull failed, will retry"
    fi
  fi
  
  # Try to push
  if git push origin "$BRANCH"; then
    echo "=========================================="
    echo "✅ Push successful on attempt $attempt"
    echo "=========================================="
    exit 0
  else
    if [ "$attempt" -lt "$MAX_RETRIES" ]; then
      # Exponential backoff: 2^attempt seconds
      wait_time=$((2 ** attempt))
      echo "⚠️  Push failed, waiting ${wait_time}s before retry $((attempt + 1))..."
      sleep $wait_time
    else
      echo "=========================================="
      echo "❌ Push failed after $MAX_RETRIES attempts"
      echo "=========================================="
      exit 1
    fi
  fi
done
