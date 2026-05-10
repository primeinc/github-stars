# Epic 02 Re-Audit on `main` (commit `ee50e48c`)

> Honest re-binding of every #43-#54 acceptance criterion to current
> state on `main`. Done after the 2026-05-10 acceptance attempts
> exposed two bugs the close-time evidence missed (cardinalby
> `mode: 'strict'` invalid, 01-fetch silent partial-success).
>
> Per `read-the-room` protocol: candidate evidence is downgraded; only
> Direct evidence supports a "Pass" verdict. "Issue auto-closed by
> squash merge" is NOT evidence; the verdict is bound to the file:line
> in `main`'s tree.

## Summary verdict

| Issue | Title | Verdict | Notes |
|---|---|---|---|
| #43 | 02A inventory | **Pass** | `.sisyphus/proofs/02A-source-inventory.md` on main; row J inventories `../refs` |
| #44 | 02B failed-runs | **Pass** | `02B-failed-runs.md` + `02M-mode-correction.md` (the latter binds run 25619344915) |
| #45 | 02C topology | **Pass** | `02C-topology.md` matches `ls .github/workflows/`; AGENTS.md updated |
| #46 | 02D auth fail-fast | **Partial** | Code is right; "valid STARS_TOKEN fetches expected stars" is **Blocked** by upstream 502 storms (run 25619534107) |
| #47 | 02E artifact handoff | **Partial** | Workflow code is right (workflow_run hard-fail in 02 verified at L101-122); end-to-end `01→02` chained run still **Blocked** by 02D upstream |
| #48 | 02F schema gate | **Pass** (post-hotfix) | `02-sync-stars` 2x + `03-classify-repos` 1x with `mode: 'default'`. Verified locally with `@exodus/schemasafe@1.3.0` against current `repos.yml`. |
| #49 | 02G web build | **Pass** | `00b-web-ci.yml` exists, ran on PR #59 + push to main, both green |
| #50 | 02H data flow | **Pass** | AGENTS.md §6 |
| #51 | 02I stale docs | **Pass** | AGENTS.md current; 3 archived plans; no broken refs in active surface |
| #52 | 02J commit/push/concurrency | **Pass** | constant concurrency groups + head_branch gates verified by `rg` on main |
| #53 | 02K summaries | **Pass** | every workflow has `$GITHUB_STEP_SUMMARY` with required fields |
| #54 | 02L acceptance run | **Blocked** | api.github.com/graphql is in a sustained 502 storm (2 consecutive runs failed with retries-exhausted on different pages). The fix is verified working — the only thing missing is a stable upstream window. |

## Per-criterion bindings

### #46 02D — Make Star-Fetch Authentication Explicit and Fail-Fast

| Criterion | Status | Evidence |
|---|---|---|
| Missing `STARS_TOKEN` fails with actionable message | **Pass** | `.github/workflows/01-fetch-stars.yml` L33-44: `Resolve token source` step branches on `STARS_TOKEN_VALUE` length, emits `::warning::` if falling back. Falls back to `GITHUB_TOKEN` (deliberate — does not fail), but the warning is structured and surfaced in the summary. **Note:** original issue says "fails with actionable message" — current behavior is "warns + falls back". This is a deliberate scope decision (don't brick scheduled runs in fork/CI contexts). Documented in AGENTS.md §8. **Direct evidence.** |
| Invalid `STARS_TOKEN` fails with actionable message | **Pass** | L106-123 (auth probe) + L120-122 (in-loop): `Bad credentials` triggers `core.setFailed(BAD_CREDENTIALS_MSG)`. **Direct evidence.** |
| Valid `STARS_TOKEN` fetches expected account stars | **Blocked** | Run 25619285899 + 25619534107 both used valid STARS_TOKEN (per logs: "Using STARS_TOKEN (PAT)") and both **failed at GraphQL upstream** before completing pagination. The token is valid (page 1 succeeded both times); pagination is broken by upstream 502s. The hotfix correctly fails on partial. **Direct evidence of token-is-valid; Blocked on chain-completes-with-token because upstream is down.** |
| Token scope requirements documented | **Pass** | AGENTS.md §8 — `read:user`. **Direct evidence.** |

### #47 02E — Replace Implicit Repo-State Handoff with Explicit Artifact Handoff

| Criterion | Status | Evidence |
|---|---|---|
| `02-sync-stars` consumes explicit artifact | **Pass** | `02-sync-stars.yml` L64-90: `Resolve fetched-stars source` + `Download fetched-stars artifact` (uses `actions/download-artifact@v4` with `run-id: ${{ github.event.workflow_run.id }}`). **Direct evidence.** |
| Missing artifact fails with name + run ID + remediation | **Pass** | L92-128: `Confirm input data` step exits 1 with `::error::Artifact download failed for triggering run …` when `mode == artifact && download.outcome != success`. **Direct evidence.** |
| Successful chained run proves handoff | **Blocked** | Same as #46 — chain blocked by 502 storm. The 2026-05-10 02:51-04:02 attempts proved the wrong things (bug A failure, then partial-success 01) but not yet a clean chain. |
| Rerun behavior documented | **Pass** | AGENTS.md §6 + #47 close comment. **Direct evidence.** |

### #48 02F — Enforce Manifest Schema Validation as a Hard Gate

| Criterion | Status | Evidence |
|---|---|---|
| `repos.yml` validation runs before commit/publish | **Pass** | `02-sync-stars.yml` L53-69 (pre-update) + L295-307 (post-update); `03-classify-repos.yml` L337-348 (post-normalize). All `mode: 'default'`. **Direct evidence.** |
| Validation failure blocks downstream | **Pass** | Step uses `cardinalby/schema-validator-action@v3` which exits non-zero on schema fail; subsequent `Convert to YAML` and `Commit` are gated on `success()`. Bug A actually proved this works in run 25619344915 — invalid `mode` made the step fail and downstream `Commit` was skipped. **Direct evidence (ironic).** |
| Validation result in workflow summary | **Pass** | `02-sync-stars.yml` summary L348+ lists "Strict schema validation against `schemas/repos-schema.json` (existing + post-update)" — though wording is "Strict" (legacy). **Direct evidence (claim is in summary; mode label outdated but functionally correct).** |
| Manual validation command documented | **Partial** | AGENTS.md §2 documents `pnpm validate` (taxonomy) + `ajv validate` (if `ajv-cli` installed). Does NOT document the cardinalby action invocation locally. The local equivalent for cardinalby is `npx @exodus/schemasafe` or installing the action via act. **Direct evidence for taxonomy + ajv; Weak for cardinalby parity.** |

### #49 02G — Add Deterministic Web Build and Lint Validation

| Criterion | Status | Evidence |
|---|---|---|
| Web build runs in CI | **Pass** | `.github/workflows/00b-web-ci.yml` L33-66 — `npm ci`, `npm run lint`, `npm run build`. Triggered on PR + push paths-filtered to `web/**`/`repos.yml`/`00b-web-ci.yml`. PR #59 ran it (run 25619232127, ~15s, success). Push to main ran it again on `5caa654c` (success). **Direct evidence.** |
| Build failure blocks downstream | **Partial** | If 00b-web-ci fails on PR, the PR is still mergeable — branch protection has NO required checks (verified earlier: `gh api repos/.../branches/main` returned `enforcement_level: off`). The CI is informational, not blocking. The chain is still protected because `04-build-site` re-runs the same build before deploy. **Direct evidence of CI runs; Weak inference on "blocks" — depends on branch protection which is off.** |
| Lint runs OR has tracked deferral | **Pass** | `00b-web-ci.yml` L62 + `04-build-site.yml` L58-60 both run `npm run lint`. No deferral. **Direct evidence.** |
| Build output path documented | **Pass** | AGENTS.md §1 + §6 (Vite → `docs/`). **Direct evidence.** |

### #52 02J — Harden Commit, Push, Concurrency, and Rerun Behavior

| Criterion | Status | Evidence |
|---|---|---|
| Commit/push has clear failure handling | **Pass** | All 4 mutating workflows (`01`, `02`, `03`, `05`) use 5-attempt rebase loop and exit 1 on exhaustion. Verified by `rg "for attempt in" .github/workflows/`. **Direct evidence.** |
| Concurrency policy documented and appropriate | **Pass** | `02-sync-stars.yml` L21 `sync-stars-main`; `03-classify-repos.yml` L25 `classify-repos-main`; `05-generate-readmes.yml` L22 `generate-readmes-main`. Constants serialize all main writers. `01-fetch-stars.yml` L11 uses `fetch-stars-${{ github.ref }}` — different scope (no main-write). `04-build-site.yml` L23 uses `build-and-deploy-${{ github.ref }}` — fine because deploy gate is on main. **Direct evidence.** |
| Rerun behavior documented and tested | **Partial** | Idempotency reasoning is documented in #52 close comment but **NOT tested by a real re-run on main**. Same blocker as #54 (no clean chain run yet). **Weak inference for "tested"; Direct for "documented".** |
| Push conflicts cannot silently produce false success | **Pass** | After hotfix `ee50e48c`, 01-fetch ALSO can't silently produce false success on partial pagination. Verified by run 25619534107 (intentionally failed with `partial_failure_reason`). **Direct evidence.** |

### #54 02L — Run Final Bulletproof Acceptance Validation

| Criterion | Status | Evidence |
|---|---|---|
| Final run URL posted | **Blocked** | No clean run yet. Two attempts: 25619285899 (passed silently → triggered bug B chain failure 25619344915 from bug A) and 25619534107 (correctly failed on partial). Both proved infrastructure correctness; neither proved end-to-end success. |
| Final commit SHA posted | **Blocked** | Same. The hotfix commit `ee50e48c` is on main but no acceptance run reached green. |
| Fetch, sync, schema validation, web build, generated outputs all proven | **Mixed** | **Web build proven** (00b-web-ci runs on every PR + push, last green on `ee50e48c`). **Schema validation proven locally** (schemasafe `default` mode passes on current `repos.yml`). **Fetch + sync NOT proven end-to-end** in the production chain. |
| Remaining failure modes have follow-up issues | **Partial** | The 502 storm is documented in `02M-mode-correction.md`. No GitHub issue opened for "expand fetch retry budget if storm continues" or "add cursor-resume". |
| Parent epic #42 updated with completion evidence | **Blocked** | Will close after the chain runs green or after the upstream-block is documented as the only remaining gap. |

## Material gaps to close (T20 work)

1. **G1 — Acceptance chain blocked by upstream 502s.** Two real options:
   - Wait for stable upstream window and retry. Cheapest. No code change.
   - Expand retry budget (MAX_RETRIES 6→10, MAX_BACKOFF 60→120s). Single page worst-case wait grows from ~3min to ~10min, still under 30min job timeout.
   - Add cursor-resume. Best long-term. Bigger feature.
2. **G2 — `00b-web-ci` is informational, not blocking.** Branch protection has no required checks. Either:
   - Add `00b-web-ci` (and `00-ci`) as required status checks on `main`. Doesn't require code, just `gh api PUT /repos/:owner/:repo/branches/main/protection/required_status_checks`.
   - Or document the deliberate deferral.
3. **G3 — `02-sync-stars.yml` summary text says "Strict schema validation"** — wording legacy from before the `mode: 'default'` flip. Cosmetic but lies about what the gate is. Fix the string.
4. **G4 — Acceptance run #54 needs follow-up issues for known remaining risks.** Currently 02M-mode-correction.md mentions "add a workflow-level dry-run … in CI that catches input-validation errors before merge" but there's no GitHub issue tracking it.
5. **G5 — Idempotency claim for sync/classify (#52) is documented but never tested by a real re-run.** Once the chain runs green, the next dispatch of 01 should produce zero diff in 02 — proving idempotency. Unblocks once G1 is unblocked.
6. **G6 — `pnpm-lock.yaml` `ERR_PNPM_IGNORED_BUILDS` risk** (mentioned in `02B-failed-runs.md` "Residual risk"). Fix is small: add `pnpm.onlyBuiltDependencies: ["esbuild"]` to root `package.json` so a future pnpm major can't reintroduce the 02-05-10 03:05 failure.

## Test coverage gap (process)

Both bugs that surfaced post-merge (cardinalby `mode: 'strict'` and 01-fetch partial-as-success) would have been caught by a workflow-level dry run. Today's CI runs `pnpm test` + `pnpm validate` + web build, but does NOT exercise the actual workflow YAML against the real action. Options:

- **Local action invocation** with `nektos/act` in CI to dry-run each workflow's first step set.
- **Smoke `actionlint`** in `00-ci.yml` to lint the workflow YAML structure (catches typos/key-name issues, but NOT input-value validation against action schemas).
- **Schema check** `cardinalby/schema-validator-action@v3` `mode` value would have failed actionlint if action.yml had `enum` — it doesn't.

This is captured as proposed follow-up; no immediate fix.
