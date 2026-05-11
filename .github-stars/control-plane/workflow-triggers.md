# Workflow trigger + concurrency doctrine

Canonical answer for: when does this repo use `on: pull_request` vs
`on: push` vs `on: pull_request_target` vs `on: merge_group`, and
what does `concurrency:` look like on each workflow.

Cited inline. Every claim is grounded in `../refs/github/docs` or
`../refs/github/github-well-architected` — no "should work."

---

## 1. Trigger taxonomy

### `pull_request`

**When**: Gates that must FIRE on every PR — required status checks,
label checks, branch-source checks, file-allowlist checks,
credential-mint checks, branch-staleness checks.

**Why** (citations):
- `../refs/github/docs/content/actions/reference/workflows-and-actions/events-that-trigger-workflows.md` L504-641: `pull_request` runs in the merge-ref context (`refs/pull/N/merge`) with `GITHUB_TOKEN` scoped read-only by default; PRs from forks do NOT receive secrets.
- Same file, L512: workflows do NOT run on PRs with merge conflicts. So `pull_request` cannot be the sole gate for the post-merge state of `main` — that's what `push: [main]` covers.
- Default activity types are `opened, synchronize, reopened`. Add `ready_for_review`, `edited`, `labeled`, `unlabeled` only when the gate logic actually reads them.

**Default activity types** to add explicitly across all gates that
depend on PR metadata: `opened, reopened, synchronize, ready_for_review, edited`.
The label-gate (00a) additionally needs `labeled, unlabeled`.

### `push`

**When**: To establish the green baseline on a long-lived branch
itself (so the branch's tip carries an authoritative status), AND to
trigger reactive automation that runs after the PR has merged.

**Why** (citations):
- `events-that-trigger-workflows.md` L825-897: `push` triggers on
  commit/tag push, `GITHUB_REF` is the updated ref. This is the
  canonical post-merge signal.
- `../refs/github/docs/data/reusables/actions/actions-group-concurrency.md` L13-24:
  GitHub's own canonical concurrency example uses `on: push: branches: [main]`
  standalone. The combination of `pull_request` + `push: [main]` is **not**
  an anti-pattern — they fire on disjoint refs:
  - `pull_request` → `refs/pull/N/merge` (PR-time)
  - `push: [main]` → `refs/heads/main` (post-merge)
  They never both run on the same ref in the same context. There is no
  "double run" during PR review.

### `pull_request_target`

**When**: NEVER, except for the narrow upstream-sanctioned uses:
posting comments / labels on PRs, or other base-context interactions
that do NOT check out PR head code.

**Why** (citations):
- `../refs/github/github-well-architected/content/library/application-security/recommendations/actions-security/index.md` L88, L205-229:
  "`pull_request_target` ... runs in the base repository context with
  full access to repository secrets and write permissions" — combined
  with checking out PR-head code, this is a "pwn request."
- `events-that-trigger-workflows.md` L706-823: same warning, plus the
  detail that `pull_request_target` runs in the BASE-branch context, so
  the workflow file used is the one already merged into base — useful
  for anti-tampering of the workflow itself, but only safe when the
  workflow does not execute PR-head code.

**This repo has zero `pull_request_target` workflows. It will stay that way.**

### `merge_group`

**When**: Only after a merge queue is enabled on the repo.

**Why**:
- `events-that-trigger-workflows.md` L356-377: the canonical pattern
  for merge-queue-aware workflows is `pull_request: branches: [main]`
  PLUS `merge_group: types: [checks_requested]`. Without a merge queue
  enabled, `merge_group` events never fire — adding them is dead code.

**Status in this repo**: NOT enabled. Adding `merge_group` triggers is
deferred until a merge queue is configured on the protected branch.
This is tracked as a follow-up; do not add `merge_group` triggers
until the queue is on.

### `workflow_dispatch`

**When**: Operator-driven mutations. The two ruleset operations
(`check`, `upsert`) are operator-initiated — they must NOT run on
arbitrary push or PR.

**Constraint** (from prior session): `workflow_dispatch` requires the
workflow file to be on the default branch (`main`) for the dispatch
button to be visible. This is why the ruleset workflow lives at
`.github/workflows/00e-branch-rulesets.yml` and merges through the
admin lane all the way to `main`.

---

## 2. Combination semantics

The user asked: "if both `pull_request: branches: [main]` and
`push: branches: [main]` are present, what happens?" Answer, grounded:

- The two events fire on **disjoint refs**. There is no duplicate run
  during PR review.
- `pull_request` fires when the PR opens / synchronizes / etc. It runs
  the workflow file from the **merge ref** (`refs/pull/N/merge`).
- `push: [main]` fires when the PR is merged to `main` (and on direct
  pushes, which are blocked by the ruleset). It runs the workflow file
  from `main` itself.
- Net effect: a PR-time check (gates the PR can't merge without it
  green) PLUS a post-merge baseline run (records the green status on
  `main` itself, useful for badges, for `actions/cache` keying off the
  branch tip, and for the next PR's `strict_required_status_checks_policy`
  comparison).

This is **canonical**, not an anti-pattern. The github docs themselves
publish `on: push: branches: [main]` as the standalone concurrency
example. Removing `push: [main]` from the gate workflows would leave
`main` without an authoritative tip status.

---

## 3. Concurrency doctrine

### Canonical shape

From `../refs/github/docs/data/reusables/actions/actions-group-concurrency.md`
L122-126 (heading: "Only cancel in-progress jobs or runs for the
current workflow"):

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

Why this shape (vs `${{ github.ref }}` alone or `${{ github.head_ref }}`):

- L116-118: "concurrency group names must be unique across workflows
  to avoid canceling in-progress jobs or runs from other workflows."
  → must include `${{ github.workflow }}`.
- `${{ github.ref }}` is well-defined for both PR (`refs/pull/N/merge`)
  and push (`refs/heads/<branch>`) events, so no fallback is needed.
  The L102-110 `github.head_ref || github.run_id` fallback is only
  necessary when the workflow ALSO runs on events where `head_ref` is
  undefined (e.g. cron, workflow_dispatch on a non-PR ref). For our
  PR+push gate workflows, plain `${{ github.ref }}` is correct.

### When `cancel-in-progress: true`

**Read-only gates that just observe state**: cancel the older run
when a new push to the same PR / branch arrives. The newer run is
the authoritative result; the older one is wasted compute.

Applies to: `00`, `00a`, `00b`, `00c`, `00d`, `00h`, `00i`, `00j`.

### When `cancel-in-progress: false`

**Mutating workflows that touch live API state**: never cancel a run
mid-PATCH. The half-applied state would be visible to the next
operator (and to the next gate run), and ruleset / branch updates are
not transactional.

Applies to: `00e` (ruleset upsert/check), `00f` (sync-protected-branches-with-main).

For these, concurrency still SERIALIZES against itself — only one
ruleset upsert and one branch-sync may be in flight at a time —
but in-progress runs complete instead of being canceled.

---

## 4. Workflow-by-workflow mapping

Eight workflow files in `.github/workflows/00*.yml`, mapped against
the doctrine above. "Trigger" reflects what the file MUST be after
this commit. "Conc." is the concurrency stanza added.

| File | Workflow `name` | Job `name` (status check) | Trigger | Conc. cancel |
|---|---|---|---|---|
| 00-ci.yml | `bun gate` | `all gates pass` | `pull_request: [main, next]` + `push: [main, next]` | true |
| 00a-do-not-merge-yet.yml | `gh-action label gate` | `DoNotMergeYet absent` | `pull_request` (any base) | true |
| 00b-web-ci.yml | `bun web build` | `build succeeds` | `pull_request: [main, next]` + `push: [main, next]` (paths-filtered on push) | true |
| 00c-main-release-guard.yml | `gh-action protected branch` | `src branch allowed` | `pull_request: [main]` | true |
| 00d-gh-action-branch-staleness.yml | `gh-action branch staleness` | `head matches main` | `pull_request: [main]` | true |
| 00e-branch-rulesets.yml | `branch-rulesets` | `branch-rulesets-check` / `branch-rulesets-upsert` | `push: [main]` (paths-filtered) + `workflow_dispatch` | **false** (mutation) |
| 00f-sync-protected-branches-with-main.yml | `sync-protected-branches-with-main` | `sync-protected-branches-with-main` | `push: [main]` + `workflow_dispatch` | **false** (mutation) |
| 00h-gh-action-file-allowlist.yml | `gh-action file allowlist` | `only allowed files` | `pull_request: [main]` | true |
| 00i-gh-app-credentials.yml | `gh-app credentials` | `token + install` | `pull_request: [main]` | true |
| 00j-gh-action-workflow-lint.yml | `gh-action workflow lint` | `workflows valid` | `pull_request: [main, next]` + `push: [main, next]` | true |

Notes:

- 00a runs on every PR regardless of base branch — the
  `DoNotMergeYet` label is a global "don't merge me" signal, not
  specific to the protected lanes.
- 00c, 00d, 00h, 00i are admin-lane-aware: they pass-through for
  non-`ghapp/repo-admin` heads so the check name remains a viable
  required-status-check on every PR to `main`.
- 00b's `push` trigger keeps the existing `paths:` filter (web build
  doesn't need to re-run on non-web pushes), but the `pull_request`
  trigger has NO `paths:` filter — non-web PRs must still get a green
  status for the required check to clear.
- 00e has a self-bootstrap path: a push to `main` that touches the
  ruleset specs (`.github-stars/control-plane/rulesets/**`) or 00e
  itself (`.github/workflows/00e-branch-rulesets.yml`) automatically
  upserts the live rulesets with `enforcement=active`. The
  `workflow_dispatch` form is kept for human-driven ops (drift checks,
  enforcement toggle, manual re-upsert) and still requires the
  `confirm_upsert=APPLY_RULESETS` typed-string guard on that path.
  00e is NOT a required status check on any ruleset — it OPERATES
  the rulesets, it doesn't gate PRs.
- 00f post-merge sync runs on `push: [main]`, not on `pull_request`
  — the work it does (calling `update-branch` and PATCHing
  `git/refs/heads/<branch>`) is only meaningful AFTER the merge to
  `main` has actually landed.

---

## 5. Required-status-check binding

The two ruleset specs in
`.github-stars/control-plane/rulesets/` must list status-check
contexts that match the JOB names in the table above (GitHub Checks
UI compares on job name, not workflow name).

`protect-main-release-only.json` required contexts:
- `head matches main` (00d)
- `only allowed files` (00h)
- `token + install` (00i)
- `src branch allowed` (00c)
- `DoNotMergeYet absent` (00a)
- `all gates pass` (00)
- `workflows valid` (00j)
- `build succeeds` (00b)

`protect-next.json` required contexts:
- `DoNotMergeYet absent` (00a)
- `all gates pass` (00)
- `workflows valid` (00j)
- `build succeeds` (00b)

This binding holds because every workflow above keeps its
`pull_request` trigger — removing `pull_request` from any of those
eight gates would silently break the required-status-check
expectation and the ruleset would block forever waiting for a check
that no longer fires on PRs.

---

## 6. Banned patterns

| Pattern | Banned because |
|---|---|
| `pull_request_target` anywhere | well-architected L88: pwn-request risk; the trigger only exists for narrow base-context use cases this repo does not have. |
| `paths:` filter on a `pull_request` gate that is a required status check | the gate would skip on irrelevant PRs and the required-status-check would stay pending forever, blocking merge. |
| `STARS_TOKEN || GITHUB_TOKEN` (or any cross-class secret OR) | mixed-credential laundering — caught by 00j. |
| `app-token.outputs.token || secrets.X` | same as above. |
| `blocked_orgs` workflow output (CSV of names) | leaks blocked source names to public Actions logs — caught by 00j. |
| `merge_group` triggers without a merge queue enabled | dead trigger; will fire never. |

---

## 7. Open follow-ups (deferred — NOT applied here)

- **Merge queue**: when enabled on `main`, add `merge_group: types: [checks_requested]` to the gate workflows that have `pull_request: branches: [main]`. Tracked separately.
- **`pull_request_target` for label/comment automation**: not applicable today; revisit only if a PR-comment-driven workflow is introduced.
