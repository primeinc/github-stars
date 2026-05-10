# 02M — Schema-validator mode correction + 01-fetch hard-fail on partial

> Direct evidence binding two production-failure root causes from the
> 2026-05-10 post-merge acceptance attempt to their fixes.
>
> Closes the gaps left open by `.sisyphus/proofs/02-evidence-map.md` row
> for #48 (which incorrectly claimed `mode: strict`) and #46/#52 (which
> did not catch the silent partial-success bug in 01-fetch).

## Bug A — `cardinalby/schema-validator-action@v3` does not accept `mode: 'strict'`

### Failed run

| Field | Value |
|---|---|
| Run URL | https://github.com/primeinc/github-stars/actions/runs/25619344915 |
| Workflow | `02-Sync Starred Repos` |
| Trigger | `workflow_run` from 01-Fetch run 25619285899 |
| Conclusion | `failure` |
| Failed step | `Validate existing manifest (strict gate)` |

### Quoted log evidence (`gh run view 25619344915 --log-failed`)

```
sync  Validate existing manifest (strict gate)  2026-05-10T04:02:40.0818458Z ##[group]Run cardinalby/schema-validator-action@v3
sync  Validate existing manifest (strict gate)  2026-05-10T04:02:40.0819580Z ##[endgroup]
sync  Validate existing manifest (strict gate)  2026-05-10T04:02:40.1648413Z ##[error]"mode" has unknown value "strict". Allowed values: default, lax, strong, spec
sync  Validate existing manifest (strict gate)  2026-05-10T04:02:40.1657474Z ##[error]Failed because of inputs error
```

### Root cause (Direct evidence)

`cardinalby/schema-validator-action@v3` — first-party source at
`C:\Users\will\dev\refs\cardinalby\schema-validator-action`
(commit `77eb17b`):

- `action.yml` L15-18: `description: 'schemasafe validation mode: default, lax, strong'`, `default: "default"`. (`spec` is also accepted per code path; not advertised in the description string.)
- `README.md` L57-62: enumerates `lax | spec | default | strong` only.

There is no `strict` value. The previous Epic 02 PR (#59, merged as
`5caa654c`) introduced `mode: 'strict'` in three places — two in
`02-sync-stars.yml` (existing line, plus my T4 work) and one new in
`03-classify-repos.yml` (my T4 lax→strict flip). All three would error
identically at action-input validation. Only 02 ran in production
because the chain failed before 03 was reached.

### Why not flip to `mode: 'strong'`

Local test against the actual schema + manifest using `@exodus/schemasafe@1.3.0` (the underlying library):

```
mode=default: ok=true errors=0
mode=lax:     ok=true errors=0
mode=strong:  COMPILE ERROR -> [complexityChecks] maxLength should be specified
              for pattern: "^v?\\d+\\.\\d+\\.\\d+$"
              at #/properties/manifest_metadata/properties/generator_version
mode=spec:    ok=true errors=0
```

`strong` mode (per `C:\Users\will\dev\refs\ExodusMovement\schemasafe\doc\Strong-mode.md`)
requires `complexityChecks`, which demands `maxLength` next to every
`pattern` keyword. Our `repos-schema.json` has at least two patterns
(`generator_version`, `github_user`) without `maxLength`. Flipping to
`strong` would crash at compile time before any data was checked.

### Resolution

`mode: 'default'` everywhere. `default` already enforces:

- `additionalProperties: false` (the schema declares this on every
  object — direct evidence: `schemas/repos-schema.json` L8, L19, L52, …)
- `required` field presence
- `type` declarations
- `enum` membership
- `pattern` regex matches
- `format: date-time` validation

It does NOT enforce schema-author hygiene like `maxLength`-after-`pattern`,
which is what `strong` adds. For Epic 02's "block bad commits" goal,
`default` is the correct level.

### Files changed

| File | Line | Change |
|---|---|---|
| `.github/workflows/02-sync-stars.yml` | 53-68 | step renamed `(strict gate)` → `(schema gate)`; `mode: 'strict'` → `mode: 'default'`; long comment block explaining the why |
| `.github/workflows/02-sync-stars.yml` | 290-296 | `(strict gate, blocks commit)` → `(schema gate, blocks commit)`; `mode: 'strict'` → `mode: 'default'` |
| `.github/workflows/03-classify-repos.yml` | 333-348 | comment + step renamed `Validate (schema, strict)` → `Validate (schema)`; `mode: strict` → `mode: default` |
| `.github/workflows/03-classify-repos.yml` | 433 | summary text updated to "(mode: default)" |
| `AGENTS.md` | 18 | table cell updated to mention mode values + why `default` |
| `AGENTS.md` | 127 | data-flow ascii block: "cardinalby strict" → "cardinalby (mode: default)" |
| `.sisyphus/proofs/02-evidence-map.md` | 15, 83-85 | corrected mode column + "strict" prose |
| `.sisyphus/proofs/02C-topology.md` | 16-17, 45 | "strict-validate" prose corrected |
| `.sisyphus/proofs/02I-docs-repair.md` | 13, 19 | "cardinalby strict" → "cardinalby (mode: default)" |
| `.sisyphus/proofs/02L-acceptance.md` | 18 | "both strict checks" → "both schema checks (mode: default)" |

### Local verification (`@exodus/schemasafe@1.3.0` against current `repos.yml` + `repos-schema.json`)

```
mode=default: ok=true errors=0
```

Run command: `node test-schemasafe.mjs` (test file not committed; reproducible by `pnpm add -D @exodus/schemasafe` and the script in this PR description).

---

## Bug B — `01-fetch-stars` reports `success` after exhausting retries on a non-first page

### Failed run (the trigger for this 02M ledger)

| Field | Value |
|---|---|
| Run URL | https://github.com/primeinc/github-stars/actions/runs/25619285899 |
| Workflow | `01-Fetch GitHub Stars` |
| Trigger | `workflow_dispatch` (T14 acceptance attempt) |
| Reported conclusion | **`success`** |
| Actual outcome | Saved 97 partial repos out of thousands; uploaded artifact `fetched-stars-25619285899` as if canonical |
| Downstream effect | `02-Sync Starred Repos` ran on the partial artifact and would have removed thousands of "missing" repos from `repos.yml` if the schema-validator step had not (incidentally) failed for unrelated reasons |

### Quoted log evidence (`gh run view 25619285899 --json …`)

```
fetch-stars: ! Transient error (500): Retrying in 1529ms (retry 1/6)...
fetch-stars: ! Transient error (502): Retrying in 2012ms (retry 2/6)...
fetch-stars: ! Transient error (502): Retrying in 6865ms (retry 3/6)...
fetch-stars: ! Transient error (502): Retrying in 12177ms (retry 4/6)...
fetch-stars: ! Transient error (502): Retrying in 21644ms (retry 5/6)...
fetch-stars: ! Transient error (502): Retrying in 48603ms (retry 6/6)...
fetch-stars: ! Error after 6 retries: <html><head><title>502 Bad Gateway</title>…
              Saving 97 partial results...
fetch-stars: ✓ fetch-stars in 3m3s   ← REPORTED SUCCESS
```

### Root cause (Direct evidence — read of `01-fetch-stars.yml` L208-218 in the
pre-fix branch)

```js
// If we have partial results, save them
if (allRepos.length > 0) {
  core.warning(`Error after ${retryCount} retries: ${error.message}. Saving ${allRepos.length} partial results...`);
  break;          // ← exits the while(hasNextPage) loop
}
// Otherwise, fail the workflow
core.error(`Failed after ${retryCount} retry attempts: ${error.message}`);
throw error;
```

After the `break`, control falls through to the unconditional file
write (`fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allRepos, …))`)
and the function returns normally. No `core.setFailed` call. The step
exits zero, the upload step's `if: success()` is true, and downstream
`02-Sync Starred Repos` (which gates on
`workflow_run.conclusion == 'success'`) runs against a sliver.

The same pattern applied to the rate-limit branch (L185-189): break,
fall through to write, exit zero.

### Resolution

| Change | Why |
|---|---|
| Added `let partialFailureReason = ''` | Captures the reason for each partial-save break path (rate-limit + retries-exhausted). |
| Both partial branches now set `partialFailureReason` to a structured string (`rate_limit_at_page_N_after_K_repos` or `retries_exhausted_at_page_N_after_K_repos_status=X_msg=Y`) | Forensics survive into the workflow summary. |
| Added a comment block on the new variable | Documents the past failure (run 25619285899) so the next reader doesn't re-introduce the bug. |
| Post-loop block writes the JSON FIRST, then `core.setFailed(…)` if `partialFailureReason` is non-empty | Forensic artifact is preserved; workflow ends in `failure`. |
| New step output `partial_failure_reason` | Surfaced in the summary block. |
| `Upload results` step: `if: success() && …` → `if: always() && steps.fetch-stars.outputs.output_bytes != ''` | Artifact uploads even on failure (forensic value). |
| `Commit results` step: explicit `if: success()` added (was implicit) | Partial JSON is NEVER committed. |
| `Fetch summary` step: new `## ⚠ Partial fetch — workflow failed` section + `Next stage` bifurcation | Operator sees what happened and that the chain is intentionally blocked. |

### Files changed

| File | Lines | Change |
|---|---|---|
| `.github/workflows/01-fetch-stars.yml` | 125-260 | partialFailureReason variable + capture in both break paths + post-loop hard-fail + new output |
| `.github/workflows/01-fetch-stars.yml` | 261-269 | Upload condition `success()` → `always() && output_bytes != ''` |
| `.github/workflows/01-fetch-stars.yml` | 290 | `Commit results` explicit `if: success()` |
| `.github/workflows/01-fetch-stars.yml` | 339-385 | `Fetch summary` env + body adds partial-reason section + bifurcated next-stage |

### Acceptance criteria mapping

| Issue | Criterion | Pre-02M | Post-02M |
|---|---|---|---|
| #46 02D | "Auth behavior is explicit, deterministic, and documented" | Auth was deterministic, but the run as a whole could silently succeed on partial data. | Pagination outcome is now binary: either the full star set is fetched (success) or the run fails with `partial_failure_reason` set. |
| #47 02E | "Successful chained run proves handoff" | Could "succeed" on partial data and trigger a destructive sync. | Sync only runs after a complete fetch (because `workflow_run` gates on `conclusion == 'success'`). |
| #48 02F | "Validation failure blocks downstream publish/update" | True for schema-validity failures, but the gate was unreachable due to Bug A. | Bug A fix makes the gate reachable; the `default` mode actually runs. |
| #52 02J | "Push conflicts cannot silently produce false success" | Generalized: partial fetch could silently produce false success. | Partial fetch is now an explicit failure with reason. |

## Why this wasn't caught earlier

The squash PR (#59) had green CI on the new branch — but `00-ci.yml`
runs only `pnpm test` + `pnpm validate` against the committed `repos.yml`,
which doesn't exercise the cardinalby action and doesn't simulate a 502
storm. There was no integration test of the chain. The first time the
action ran with my changes was T14 on `main` post-merge, which is
exactly when both bugs surfaced. Recommendation tracked as future work
in #54: add a workflow-level dry-run or local-action invocation in CI
that catches input-validation errors before merge.
