# 02I — Stale Agent Docs and Plans Repair (closes #51)

> Direct evidence that agent-facing instructions and historical plans
> reflect the current source tree on this branch.

## Active docs — what changed and why

### `AGENTS.md`

| Section | Before this epic | After this epic | Why |
|---|---|---|---|
| §1 Project Overview | "No Local Build" | TypeScript toolchain in `src/`; web app in `web/` with separate CI gate (`00b-web-ci.yml`) | The repo grew a real local toolchain (`pnpm test`/`validate`/`repro:taxonomy`) and a Vite/React surface; the doc denied both. |
| §2 Build, Test, Validation | Single bullet, "JSON Schema validation in CI workflows 02/04" | Table separating **JSON Schema** (`cardinalby` strict, in 02 + 03) from **Taxonomy** (`pnpm validate`, in 00-ci + 03) | The two validators check different invariants. The old wording also miscounted workflows (04 doesn't validate). Caught by Copilot review on PR #58. |
| §2 Local toolchain | Said `pnpm validate` runs `cli-validate.ts` "against `schemas/repos-schema.json`" | Says `pnpm validate` is the **taxonomy** gate, separate from JSON Schema | `src/cli-validate.ts` calls `validateManifest` from `src/manifest/validator.ts`, which validates taxonomy membership, not JSON Schema. Verified by reading the source. |
| §2 Running Workflows | Listed `01-fetch-stars`, `02-sync-stars`, `03-curate-stars` | Lists all six actual workflows (00-ci, 00b-web-ci, 01..05) | `03-curate-stars` was renamed to `03-classify-repos`; `04-build-site` and `05-generate-readmes` were never documented; `00b-web-ci` is new on this branch. See `02C-topology.md`. |
| §4 heading | "AI & Copilot Rules (from docs/COPILOT_SETUP.md)" | "AI & Copilot Rules" | `docs/COPILOT_SETUP.md` does not exist in the repo (`git ls-files docs/` returns only build outputs). The parenthetical pointed at a missing file. Killed the parenthetical; kept the rules text since it's still accurate. |
| §5 Directory Structure | `docs/` listed as "Documentation" | `docs/` listed as Vite **build output** of `web/` | Source moved to `web/src/` long ago; treating `docs/` as docs leads agents to hand-edit generated files. Caught by archived plan `site-sorting-fix.md`. |
| §6 Generated Data Flow | (didn't exist) | End-to-end ASCII pipeline + producer/consumer/committed table | New section. Bound to issue #50 (02H) acceptance. |
| §6 03-classify gates description | "normalizes + strict-validates against taxonomy" | "pnpm normalize → cardinalby strict (HARD GATE) → pnpm validate (HARD GATE)" | Reflects the gate reorder in `03-classify-repos.yml` for 02F (lax → strict). |
| §8 Token Model | (didn't exist) | Explicit `STARS_TOKEN || GITHUB_TOKEN` model + scope, fallback warning | New section. Bound to issue #46 (02D) acceptance. |

### `.github/workflows/01-fetch-stars.yml`

| Line | Before | After | Why |
|---|---|---|---|
| Backoff comment (~L86) | `// Exponential backoff with full jitter` | `// Exponential backoff with "equal jitter" ([0.5, 1.0) * cappedExp)…` | The math `(0.5 + Math.random() * 0.5) * expSec` is "equal jitter" (per AWS architecture blog), not full jitter. Caught by Copilot review on PR #55. |

## Archived plans (`.sisyphus/plans/`)

All three plans now carry an explicit `Status: ARCHIVED` header. Verified
by `rg -n "Status: ARCHIVED" .sisyphus/plans/`.

| File | Archive reason |
|---|---|
| `mvp-phase-2.md` | Implemented — `05-generate-readmes.yml` exists and is the active README generator. |
| `site-sorting-fix.md` | Superseded — targeted `docs/app.js` and `docs/index.html`, both now Vite build outputs. Sort behavior implemented in `web/src/App.jsx` (`user_starred_at` desc; verified at L75-76). |
| `terminology-refactor.md` | Completed and superseded — `user_starred_at`, `repo_pushed_at`, `manifest_updated_at`, `classified_at` are live in `repos.yml` and `schemas/repos-schema.json`. Doc still cited `docs/app.js` (now a build output), so flagged superseded. |

## Files referenced from active docs that DO exist

Verified by `git ls-files` and direct read:

- `schemas/repos-schema.json` ✓
- `queries/stars-query.graphql` ✓
- `src/manifest/{loader,normalizer,validator,writer,taxonomy,types,index}.ts` ✓
- `src/cli-validate.ts`, `src/cli-normalize.ts`, `src/repro-taxonomy.ts` ✓
- `fixtures/repos.invalid.yml` ✓
- `web/vite.config.js`, `web/src/App.jsx` ✓
- `.github-stars/data/fetched-stars-graphql.json`, `.github-stars/repos-template.yml` ✓

## Files referenced from active docs that DO NOT exist

| Reference | Status | Action |
|---|---|---|
| `docs/COPILOT_SETUP.md` | Missing — `git ls-files` returns nothing | §4 parenthetical removed; rule text kept (still accurate). |

No other broken references. Verified by `rg -n "docs/[A-Z_]+\.md"` against
active docs surface.

## Acceptance criteria mapping (#51)

| Criterion | Evidence |
|---|---|
| Active agent instructions reference current source paths and workflow names | `AGENTS.md` §2 §5 §6 — all paths resolve in `git ls-files`. Workflow names match files (see `02C-topology.md`). |
| Stale plans corrected or marked archived/superseded | All three plans carry `Status: ARCHIVED` in their headers. |
| No active doc instructs agents to edit nonexistent files | `docs/COPILOT_SETUP.md` reference removed; jitter comment fixed; archived plans cite their stale paths only as historical context. |
| No active doc claims an unavailable workflow exists | `03-curate-stars` removed from `AGENTS.md`. |

## Read ledger

- `AGENTS.md` (full)
- `.sisyphus/plans/mvp-phase-2.md` (full)
- `.sisyphus/plans/site-sorting-fix.md` (full)
- `.sisyphus/plans/terminology-refactor.md` (full)
- `.github/workflows/01-fetch-stars.yml` (full)
- `src/cli-validate.ts`, `src/manifest/validator.ts` (full — to confirm `pnpm validate` is taxonomy-only)
- `web/src/App.jsx` (L70-80 — to confirm sort field is `user_starred_at`)
