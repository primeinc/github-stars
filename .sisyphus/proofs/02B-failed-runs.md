# 02B — Failed Run Capture (closes #44)

> Direct evidence binding the most-recent CI failure on the Epic 02 branch
> to a specific log line, root cause, and resolution commit.

## Failed run

| Field | Value |
|---|---|
| Run URL | https://github.com/primeinc/github-stars/actions/runs/25618306848 |
| Run ID | `25618306848` |
| Workflow | `CI` (`.github/workflows/00-ci.yml`) |
| Job | `test` |
| Trigger | `pull_request` (PR #56) |
| Branch | `claude/fix-epic-02-1Fbxq` |
| Commit | `62c2ae16` "Epic 02: harden automation pipeline (artifact handoff, hard gates, proof summaries)" |
| Conclusion | `failure` |
| Created | 2026-05-10T03:05:03Z |

## Failed step

`Install dependencies`. Command: `pnpm install`.

## Quoted log evidence (`gh run view 25618306848 --log-failed`)

```
test  Install dependencies  2026-05-10T03:05:17.3923234Z [ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@0.21.5, esbuild@0.27.3
test  Install dependencies  2026-05-10T03:05:17.3923817Z
test  Install dependencies  2026-05-10T03:05:17.3924312Z Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
test  Install dependencies  2026-05-10T03:05:17.4296167Z ##[error]Process completed with exit code 1.
```

## Root cause (Direct evidence)

`pnpm@latest` at the time of run 25618306848 enforced
`ERR_PNPM_IGNORED_BUILDS` as a hard exit-1 (vs. a warning in earlier
versions). Two transitive `esbuild` versions (`0.21.5`, `0.27.3`) ship
postinstall scripts that pnpm refused to execute without an explicit
allowlist (`onlyBuiltDependencies` in `package.json` or
`pnpm-workspace.yaml`). The repo had no allowlist at the time, so the
install step exited 1 immediately after dependency resolution.

Earlier theories — "transient registry/network failure" — are
**unsupported** by this log. The install completed dependency download
in <2 s; the failure is policy-driven, not transient.

## Resolution

| Field | Value |
|---|---|
| Commit | `e96df3fb` "ci: pin pnpm to 10.13.1 and retry install on transient failures" |
| File | `.github/workflows/00-ci.yml` |
| Change | `npm install -g pnpm@latest` → `npm install -g pnpm@10.13.1` |
| Effect | `pnpm@10.13.1` treats ignored build scripts as a **warning** (not exit-1), so install completes. |

## Successful re-run (Direct evidence of resolution)

| Field | Value |
|---|---|
| Run URL | https://github.com/primeinc/github-stars/actions/runs/25618372636 |
| Workflow | `CI` |
| Commit | `e96df3fb` |
| Trigger | `pull_request` (same PR #56) |
| Conclusion | `success` |
| Jobs | `test` ✓ (10 s), `web` ✓ (15 s) |
| Annotations | Only the deprecation notice for `actions/setup-node@v4` running on Node.js 20 (non-blocking, June 2026 cutover). |

## Residual risk (Weak inference)

`pnpm@10.13.1` is pinned but a future pnpm major could change the policy
again. To remove the risk entirely, add an explicit `onlyBuiltDependencies`
allowlist to `package.json` or commit a `pnpm-workspace.yaml`:

```json
{
  "pnpm": {
    "onlyBuiltDependencies": ["esbuild"]
  }
}
```

Filed for follow-up; not blocking 02B.

## Acceptance criteria mapping (#44)

| Criterion | Evidence |
|---|---|
| Latest failed run identified by URL/ID/SHA | run `25618306848`, SHA `62c2ae16` |
| Failure cause quoted from log output | `ERR_PNPM_IGNORED_BUILDS` block above |
| Missing upstream context marked Blocked | None — the failed step's full log was readable |
| No patch claimed canonical until failed job/step is known | The `e96df3fb` commit was authored after this exact log was read |

## Proof commands

```bash
gh run view 25618306848 --repo primeinc/github-stars --log-failed
gh run view 25618372636 --repo primeinc/github-stars
```
