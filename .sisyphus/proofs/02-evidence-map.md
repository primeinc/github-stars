# Epic 02 — Evidence Map

> Cross-reference table mapping each Epic 02 sub-issue acceptance
> criterion to the file:line, commit SHA, or workflow gate that proves
> it. Read alongside `02A-source-inventory.md`, `02B-failed-runs.md`,
> `02C-topology.md`, and `02I-docs-repair.md`.

| Issue | Criterion (paraphrased) | Evidence | Status |
|---|---|---|---|
| **#43 02A** | Inventory all canonical sources + `../refs` | `.sisyphus/proofs/02A-source-inventory.md` (149 tracked files, all rows labeled Direct evidence) | ✓ |
| **#44 02B** | Bind latest failure to log | `.sisyphus/proofs/02B-failed-runs.md` (run 25618306848, SHA `62c2ae16`, ERR_PNPM_IGNORED_BUILDS) | ✓ |
| **#45 02C** | Reconcile workflow topology | `.sisyphus/proofs/02C-topology.md` (6 workflows; `03-curate-stars` → `03-classify-repos`) | ✓ |
| **#46 02D** | Make star-fetch auth explicit and fail-fast | `01-fetch-stars.yml` L29 (`secrets.STARS_TOKEN || secrets.GITHUB_TOKEN`), L48-63 (Bad credentials handler), L120-122 (in-loop bad-creds short-circuit), `AGENTS.md` §8 | ✓ |
| **#47 02E** | Replace implicit handoff with explicit artifact | `01-fetch-stars.yml` artifact upload + `02-sync-stars.yml` L73-89 (artifact mode resolution) + L101-122 (hard-fail on missing artifact in workflow_run mode, commit `d40c4995`) | ✓ |
| **#48 02F** | Schema validation as hard gate everywhere | `02-sync-stars.yml` (pre-update + post-update, `mode: default`), `03-classify-repos.yml` (post-normalize, `mode: default`). The cardinalby action does NOT accept `mode: 'strict'`; see `.sisyphus/proofs/02M-mode-correction.md`. | ✓ |
| **#49 02G** | Web build + lint as CI gate | `00b-web-ci.yml` (new on this branch): `npm ci`, `npm run lint`, `npm run build`, output verification | ✓ |
| **#50 02H** | Canonicalize generated data flow | `AGENTS.md` §6 (ASCII pipeline + producer/consumer/committed table) | ✓ |
| **#51 02I** | Repair stale agent instructions | `.sisyphus/proofs/02I-docs-repair.md` (AGENTS.md changes, archived plans, missing-doc reference removed) | ✓ |
| **#52 02J** | Harden commit/push/concurrency/rerun | `02-sync-stars.yml` constant concurrency `sync-stars-main` + workflow_run head_branch gate (L25, L31-37); `03-classify-repos.yml` constant `classify-repos-main`; `05-generate-readmes.yml` constant `generate-readmes-main` + push trigger gated to main; commit `535059f0` | ✓ |
| **#53 02K** | Proof-rich workflow summaries | All six workflows write `$GITHUB_STEP_SUMMARY` with workflow/run/trigger/SHA/inputs/gates/outputs/next-stage. Examples: `02-sync-stars.yml` L255-end; `03-classify-repos.yml` L397-end; `04-build-site.yml` L77-114; `05-generate-readmes.yml` summary block. | ✓ |
| **#54 02L** | Final acceptance run | `.sisyphus/proofs/02L-acceptance.md` — populated after the production chain runs (T14). | pending |

## Sub-issue-by-sub-issue spot evidence

### #46 (02D) — Token model

```yaml
# .github/workflows/01-fetch-stars.yml L25-29
- name: Fetch starred repositories
  uses: actions/github-script@v8
  id: fetch-stars
  with:
    github-token: ${{ secrets.STARS_TOKEN || secrets.GITHUB_TOKEN }}
```

Bad-credentials handler: L48-63 (auth probe with retry on 5xx) + L120-122
(in-loop short-circuit on bad creds during pagination).

`AGENTS.md` §8 documents the model, scope (`read:user`), and fallback
warning behavior.

### #47 (02E) — Explicit artifact handoff

```yaml
# .github/workflows/02-sync-stars.yml — Resolve fetched-stars source (L65+)
- name: Resolve fetched-stars source
  id: source
  ...
  if [ "$EVENT_NAME" = "workflow_run" ] && [ -n "${TRIGGER_RUN_ID:-}" ]; then
    echo "mode=artifact"
    ...
  else
    echo "mode=committed"
    echo "workflow_dispatch: using committed .github-stars/data/fetched-stars-graphql.json"
  fi

- name: Download fetched-stars artifact (canonical handoff)
  if: steps.source.outputs.mode == 'artifact'
  ...
  uses: actions/download-artifact@v4
  with:
    name: ${{ steps.source.outputs.artifact_name }}
    run-id: ${{ github.event.workflow_run.id }}

- name: Confirm input data
  ...
  # In workflow_run mode the artifact is the canonical handoff. If
  # the download did not succeed (missing artifact, expired
  # retention, permission failure), fail hard instead of silently
  # reconciling against potentially-stale committed data.
  if [ "$MODE" = "artifact" ] && [ "$DOWNLOAD_OUTCOME" != "success" ]; then
    exit 1
  fi
```

Commit `d40c4995` is the change that made workflow_run-mode artifact
download fail-hard.

### #48 (02F) — Schema validation hard gates

| Location | Mode | Gate? |
|---|---|---|
| `02-sync-stars.yml` pre-update | `default` | yes |
| `02-sync-stars.yml` post-update | `default` | yes (blocks commit) |
| `03-classify-repos.yml` post-normalize | `default` (was `lax`) | yes (blocks commit) |
| `00-ci.yml` | (taxonomy only via `pnpm validate`) | yes |
| `00b-web-ci.yml` | (regenerates `web/public/data.json` from `repos.yml`; broken yaml fails the gate) | yes |

### #49 (02G) — Web CI gate

`00b-web-ci.yml` runs on PR + push to `main`, paths-filtered to
`web/**` and `repos.yml`. Steps: `npm ci`, `npm run lint`, `npm run
build`, verify `docs/index.html` and `docs/data.json` exist.

### #50 (02H) — Generated data flow

Documented in `AGENTS.md` §6. Each generated artifact has a producer
and consumer; commit policy is in the table at the end of §6
(`docs/`, `categories/`, `tags/` are pure generated output, never
hand-edited; `docs/data.json` re-emitted from `repos.yml` on every build).

### #52 (02J) — Concurrency / rerun behavior

Verified constants instead of `${{ github.ref }}`:

```bash
$ rg -n "concurrency|cancel-in-progress" .github/workflows/
00b-web-ci.yml:23: group: web-ci-${{ github.ref }}     # PR-scoped, cancels stale PR pushes
01-fetch-stars.yml:    (none — daily cron, no concurrent dispatch expected)
02-sync-stars.yml:21:  group: sync-stars-main          # constant; serializes all main writers
03-classify-repos.yml: group: classify-repos-main      # constant
04-build-site.yml:23:  group: build-and-deploy-${{ github.ref }}
05-generate-readmes.yml: group: generate-readmes-main  # constant
```

`workflow_run` triggers on 02/03/05 are gated to
`workflow_run.head_branch == 'main'` so a non-main fetch can't write
`main`.

### #53 (02K) — Proof-rich summaries

Each workflow's `$GITHUB_STEP_SUMMARY` block reports: workflow name,
run ID, trigger, commit SHA, inputs (artifact name / source / bytes /
batch size), gates (which validators ran), outputs (counts, file
existence), and next stage.

## Notes

- **Non-trivial deviation from #54's wording:** the original #54 says
  "fetch, sync, schema validation, web build, and generated output
  stages are all proven." 02L's chain run will exercise 01 → 02 → 03
  → 04 → 05. `00b-web-ci.yml` is exercised on the merge PR itself, not
  on a workflow_run; that's noted in `02L-acceptance.md`.
