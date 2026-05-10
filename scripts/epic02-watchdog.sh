#!/usr/bin/env bash
set -euo pipefail

REPO="primeinc/github-stars"
WORKDIR="$HOME/dev/github-stars"
LOGDIR="$WORKDIR/.sisyphus/logs"
STATEDIR="$WORKDIR/.sisyphus/state"
STATE="$STATEDIR/epic02-watchdog.state.json"
RUNS_JSON="$STATEDIR/epic02-runs.json"

mkdir -p "$LOGDIR" "$STATEDIR"

cd "$WORKDIR"

echo "=== epic02 watchdog $(date -Is) ==="

git fetch origin main
MAIN_SHA="$(git rev-parse origin/main)"

echo "main_sha=$MAIN_SHA"

echo "--- open issues ---"
gh issue list \
  --repo "$REPO" \
  --state open \
  --limit 50 \
  --json number,title,state,url

echo "--- latest main runs ---"
gh run list \
  --repo "$REPO" \
  --branch main \
  --limit 40 \
  --json databaseId,workflowName,event,status,conclusion,createdAt,updatedAt,headSha,url \
  > "$RUNS_JSON"

cat "$RUNS_JSON"

set +e
RUNS_JSON_PATH="$RUNS_JSON" python3 <<'PY'
import json, os, sys
from pathlib import Path

runs = json.loads(Path(os.environ["RUNS_JSON_PATH"]).read_text())

wanted = [
    "01-Fetch GitHub Stars",
    "02-Sync Starred Repos",
    "03-Classify Repos",
    "04-Build and Deploy Site",
    "05-Generate READMEs",
]

latest = {}
for r in runs:
    name = r["workflowName"]
    if name in wanted and name not in latest:
        latest[name] = r

missing = [w for w in wanted if w not in latest]
if missing:
    print("VERDICT=BLOCKED")
    print("REASON=missing_workflow_runs")
    print("MISSING=" + ",".join(missing))
    sys.exit(20)

for name in wanted:
    r = latest[name]
    print(f"{name}: status={r['status']} conclusion={r['conclusion']} url={r['url']}")

in_progress = [n for n, r in latest.items() if r["status"] != "completed"]
failed = [n for n, r in latest.items()
          if r["status"] == "completed" and r["conclusion"] not in ("success",)]

if in_progress:
    print("VERDICT=IN_PROGRESS")
    print("WAITING_ON=" + ",".join(in_progress))
    sys.exit(10)

if failed:
    print("VERDICT=BLOCKED")
    print("FAILED=" + ",".join(failed))
    sys.exit(20)

print("VERDICT=GREEN")
print("RUN_URLS=" + " ".join(latest[n]["url"] for n in wanted))
sys.exit(0)
PY
rc=$?
set -e

case "$rc" in
  0)
    echo "GREEN: acceptance chain is terminal success."
    echo "Required next action: populate .sisyphus/proofs/02L-acceptance.md, commit to main, close #54, then close #42."
    ;;
  10)
    echo "IN_PROGRESS: do not claim done."
    ;;
  20)
    echo "BLOCKED: do not claim done. Post blocker to #54/#42 with failed run URL and log excerpt."
    ;;
  *)
    echo "UNKNOWN watchdog error: rc=$rc"
    ;;
esac

# Propagate the predicate rc so the cron / caller can branch on it.
exit "$rc"
