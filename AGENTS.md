# AGENTS.md - GitHub Stars Curation System

This file contains instructions for AI agents (and human contributors) working on this codebase.

## 0. Read-the-room rule (mandatory before writing code)

**No implementation begins without first-party canonical evidence.**

Required sequence on every implementation surface:

```text
read local refs (this file, the issue body+comments, the affected
  workflow/source/test files, .github-stars/docs/* if relevant)
  -> find upstream canonical implementation shape (../refs/* first;
     first-party docs second; first-party source third; first-party
     tests/fixtures fourth)
  -> understand why upstream chose the shape (read the rationale,
     not just the code)
  -> map upstream shape to local constraints (host-io boundary, Zod
     registry, telemetry doctrine, no-loose-zod, no-handrolling-SDKs)
  -> write the smallest coherent patch
  -> prove it with `bun run gate` (10 stages must pass) + targeted
     tests
```

**Forbidden as primary authority:** blog posts, StackOverflow answers,
LLM memory, unread search-result snippets, "I've done this before" in
another repo. Practitioner sources are usable only after first-party
sources are exhausted.

**Every PR must include the read-the-room evidence block** specified
in `.github/PULL_REQUEST_TEMPLATE.md`. No block, no merge.

**Evidence labels** (use in PR body and completion comments):

```text
Direct evidence: exact local file, issue, upstream doc/source/test,
  command output, workflow run, or artifact.
Weak inference: plausible mapping from direct evidence but not
  literally proven.
Unsupported: claim not grounded in read evidence.
Blocked: required source/file/tool unavailable.
Contradicted: direct evidence conflicts with the implementation claim.
```

Source: issue #75. Doctrine: PRs that skip this rule produce YAML
taxidermy and fake architecture; the rule is enforceable governance,
not aspiration.



## 1. Project Overview
This is a **TypeScript control plane orchestrated by GitHub Actions** for curating starred repositories. Per issue #69, runtime policy lives in typed modules under `src/`; workflow YAML is orchestration only.
- **Core logic**: typed modules under `src/auth/`, `src/fetch/`, `src/sync/`, `src/diagnostics/`, `src/generated/`, `src/gate/`, plus the existing `src/manifest/`. Workflows under `.github/workflows/` invoke these via `pnpm <script>` rather than embedding business logic in YAML/JavaScript.
- **Single readiness command**: `pnpm gate` runs typecheck + test + validate + generated-artifact registry + actionlint, in that order, fail-fast. `00-ci.yml` calls `pnpm gate` as its primary gate.
- **Auth model**: `src/auth/resolve-auth-mode.ts` is the source of truth for which credential drives which capability. Modes: `github_app` (preferred), `pat`, `public`, `github_token` (degraded), `disabled`. The resolver runs as `pnpm auth:doctor` (alias for `tsx src/auth/setup-doctor.ts`) and writes per-job outputs `auth_mode`, `star_source_user`, `star_fetch_auth`, `repo_write_auth`, `degraded`. See §8.
- **Generated artifacts**: every committed artifact has a producer/consumer/policy entry in `src/generated/registry.ts`; `pnpm gate` checks each is present.
- **Database**: `repos.yml` (YAML manifest). Two independent gates protect it: a **JSON Schema** gate (`schemas/repos-schema.json`, enforced by `cardinalby/schema-validator-action@v3`) and a **taxonomy** gate (`src/manifest/taxonomy.ts`).
- **Web surface**: a Vite + React app under `web/` builds to `docs/` and is deployed to GitHub Pages by `04-build-site.yml`. A separate CI gate (`00b-web-ci.yml`) runs `npm ci`/`lint`/`build` on every PR + push to `main`.

## 2. Build, Test, and Validation

`repos.yml` has **two distinct validators** that protect different invariants. Do not confuse them.

| Gate | Implementation | Validates | Local command | Workflows that enforce it |
|---|---|---|---|---|
| **JSON Schema** (structural) | `cardinalby/schema-validator-action@v3` (`mode: default`, schemasafe under the hood) against `schemas/repos-schema.json` | Field presence, types, `additionalProperties: false`, enum membership, patterns. Note: the action's mode values are `default`/`lax`/`strong`/`spec` — there is no `strict`. `default` already enforces the schema's `additionalProperties: false`. `strong` would also require coherence checks like `maxLength` next to every `pattern`, which our schema does not satisfy (see `.sisyphus/proofs/02M-mode-correction.md`). | `ajv validate -s schemas/repos-schema.json -d repos.yml` (if `ajv-cli` installed) | `02-sync-stars.yml` (twice — pre and post update), `03-classify-repos.yml` (post-normalize) |
| **Taxonomy** (semantic) | `src/manifest/validator.ts`, invoked by `src/cli-validate.ts` | Each repo's `categories[]`/`tags[]` are members of the canonical taxonomy in `src/manifest/taxonomy.ts`; no orphan or misspelled labels | `pnpm validate` | `00-ci.yml` (every PR/push to `main`), `03-classify-repos.yml` (post-classify, after `pnpm normalize`) |

**`pnpm validate` is the taxonomy gate, not the schema gate.** It will pass on a manifest that fails JSON Schema and vice versa. To get full coverage locally:

```bash
pnpm validate                                                      # taxonomy
ajv validate -s schemas/repos-schema.json -d repos.yml             # schema (if ajv-cli installed)
```

### Local toolchain (Node / pnpm)
- Install: `pnpm install` (lockfile is `pnpm-lock.yaml`, `lockfileVersion 9.0`; CI pins `pnpm@10.13.1`).
- **Readiness check (use this first)**: `pnpm gate` — runs all sub-gates: typecheck, test, validate, generated-artifact registry, actionlint. Mirrors what CI runs.
- Sub-gates (run individually):
  - `pnpm typecheck` (`tsc --noEmit`)
  - `pnpm test` (vitest)
  - `pnpm validate` (taxonomy strict on `repos.yml`)
  - `pnpm repro:taxonomy` (regenerates the failing fixture used by tests)
  - `pnpm normalize` (in-place canonicalization of `repos.yml`)
- Workflow CLIs (also invocable locally with `GH_TOKEN`):
  - `pnpm auth:doctor` — print active auth mode + capability matrix.
  - `pnpm fetch:stars` — full two-stage fetch into `.github-stars/data/fetched-stars-graphql.json`.
  - `pnpm sync:stars` — reconcile `repos.yml` against the fetched JSON.
- `00-ci.yml` runs `pnpm gate` as the primary gate; PRs and pushes to `main` must pass it.

### Running Workflows
Actual workflow files in `.github/workflows/` (numbered, run in order via `workflow_run` chaining):
- `00-ci.yml` — PR/push CI: vitest, taxonomy repro, manifest validation.
- `01-fetch-stars.yml` — daily cron + manual: pulls starred repos via GraphQL, writes `.github-stars/data/fetched-stars-graphql.json`, uploads artifact, commits.
- `02-sync-stars.yml` — triggered on `01` success: reconciles `repos.yml` with fetched stars.
- `03-classify-repos.yml` — triggered on `02` success: AI classification of new/needs-review repos.
- `04-build-site.yml` — triggered on `03` success: builds the site under `web/` to `docs/` and deploys.
- `05-generate-readmes.yml` — triggered on `03` success: regenerates per-category README files.

Trigger any workflow manually via the GitHub Actions tab (`workflow_dispatch`).

## 3. Code Style Guidelines

### JavaScript (Embedded in Actions)
- **Format**: CommonJS (for `actions/github-script`).
- **Indentation**: 2 spaces.
- **Semicolons**: Yes.
- **Async/Await**: Heavy usage for GitHub API calls.
- **Error Handling**: Use `try/catch` blocks. Use `core.setFailed(message)` to fail the Action step.
- **Logging**: Use `core.info()`, `core.warning()`, `core.error()`.

### YAML (Manifests & Workflows)
- **Indentation**: 2 spaces.
- **Naming**: `kebab-case` for keys in `repos.yml` (as defined in schema).
- **Structure**:
  - `repos.yml` MUST follow `schemas/repos-schema.json`.
  - Feature flags in `feature_flags` object.

### Naming Conventions
- **Files**: `kebab-case` (e.g., `repos-schema.json`, `01-fetch-stars.yml`).
- **JS Variables**: `camelCase`.
- **Schema Properties**: `snake_case` (e.g., `generated_at`, `total_repos`, `ai_sort`).

## 4. AI & Copilot Rules

### General Interaction
- **Explain First**: Use `/explain` or `@workspace` to understand the code/schema before editing.
- **Descriptive Comments**: Add comments explaining *intent* before asking for code.
  ```yaml
  # Good: Specific intent
  # Fetch all starred repositories for the authenticated user using GraphQL API
  ```

### Workflow Editing
- Use **Red Hat YAML** extension logic for schema validation.
- When editing workflows, ensure you reference correct `secrets` and `steps` outputs.

### Schema Editing
- Always validate changes against `schemas/repos-schema.json`.
- If modifying schema, update `schema_version`.

### Classification Prompts
- AI prompts are embedded in workflows (or external files).
- maintain clear instructions for the AI model (GPT-4o) in these prompts.

## 5. Directory Structure
- `.github/workflows/`: Orchestration only. Workflows invoke `pnpm <script>` for any non-trivial logic.
- `schemas/repos-schema.json`: JSON Schema, source of truth for `repos.yml`.
- `queries/stars-list-query.graphql`: cheap pagination query (stage 1).
- `queries/stars-metadata-fragment.graphql`: per-repo metadata fragment (stage 2).
- `src/auth/`: auth mode types, resolver, setup-doctor.
- `src/fetch/`: fetch-stars orchestrator + cli, list paginator, metadata batcher, partial-graphql handling, octokit client wrapper.
- `src/sync/`: reconcile (with 5% destructive-deletion guard), manifest io, cli.
- `src/diagnostics/`: evidence labels, $GITHUB_STEP_SUMMARY helpers.
- `src/generated/registry.ts`: typed registry of every committed/artifacted output.
- `src/gate/cli.ts`: `pnpm gate` runner (typecheck + test + validate + registry + actionlint).
- `src/manifest/`: TypeScript loader/normalizer/validator for `repos.yml`.
- `src/cli-validate.ts`, `src/cli-normalize.ts`, `src/repro-taxonomy.ts`: Local CLI entry points.
- `fixtures/repos.invalid.yml`: Failing fixture used by `pnpm repro:taxonomy`.
- `web/`: Vite + React site source. **`docs/` is its build output.**
- `categories/`, `tags/`: Markdown generated by `05-generate-readmes`.
- `.github-stars/data/`: Workflow-staged JSON (artifact + transient sync state).
- `.sisyphus/plans/`: Historical plans (treat any pre-existing plan as
  archived unless it explicitly says otherwise).
- `repos.yml`: The database, generated/updated by Actions.

## 6. Generated Data Flow (canonical, end-to-end)

```
GitHub stars (per user)
   │  graphql: stage 1 cheap list (queries/stars-list-query.graphql)
   │           + stage 2 per-repo metadata (queries/stars-metadata-fragment.graphql)
   ▼
01-fetch-stars.yml (cron + workflow_dispatch)
   ├── writes  .github-stars/data/fetched-stars-graphql.json   (transient JSON)
   ├── uploads artifact `fetched-stars-${{ github.run_id }}`   (canonical handoff)
   └── commits the JSON (legacy fallback path)
   │
   ▼  workflow_run "01-Fetch GitHub Stars" completed
02-sync-stars.yml
   ├── downloads the triggering run's artifact (preferred)
   ├── falls back to the committed JSON if artifact is missing
   ├── reconciles with repos.yml (adds new, removes unstarred)
   ├── validates repos.yml against schemas/repos-schema.json (HARD GATE)
   └── commits repos.yml
   │
   ▼  workflow_run "02-Sync Starred Repos" completed
03-classify-repos.yml
   ├── AI-classifies unclassified/needs_review repos in batches
   ├── pnpm normalize → cardinalby (mode: default) HARD GATE → pnpm validate (taxonomy strict) HARD GATE
   └── commits repos.yml; self-dispatches if more remain
   │
   ▼  workflow_run "03-Classify Repos" completed (fans out)
04-build-site.yml                              05-generate-readmes.yml
   ├── yq → web/public/data.json                  ├── reads repos.yml
   ├── npm ci, lint, build → docs/                ├── writes categories/*.md
   ├── re-emits docs/data.json from repos.yml     ├── writes tags/*.md
   └── deploy-pages (GitHub Pages)                └── writes README.md
```

| Stage             | Producer            | Consumer            | Input                                   | Output                                         | Committed? |
|-------------------|---------------------|---------------------|-----------------------------------------|------------------------------------------------|-----------|
| fetch             | `01-fetch-stars`    | `02-sync-stars`     | GitHub GraphQL                          | `.github-stars/data/fetched-stars-graphql.json` + artifact | yes (legacy) + artifact (canonical) |
| sync              | `02-sync-stars`     | `03-classify-repos` | fetched JSON (artifact / committed)     | `repos.yml`                                    | yes |
| classify          | `03-classify-repos` | `04`, `05`          | `repos.yml`                             | `repos.yml`                                    | yes |
| site build        | `04-build-site`     | GitHub Pages        | `repos.yml`                             | `docs/` (incl. `docs/data.json`)               | yes |
| readmes           | `05-generate-readmes` | repo viewers       | `repos.yml`                             | `README.md`, `categories/*.md`, `tags/*.md`    | yes |

**Stale-residue policy:** `docs/` and `categories/`, `tags/` are pure
generated output. Do not hand-edit. The README generator deletes orphan
files in `categories/` and `tags/` automatically.

## 7. Critical Constraints
- **Zero External Dependencies**: Logic must run in standard GitHub Actions runners.
- **Free Tier**: Do not introduce paid dependencies or services.
- **Idempotency**: Workflows should be safe to re-run.

## 8. Auth model

The auth resolver (`src/auth/resolve-auth-mode.ts`) is the source of truth — workflows do NOT use implicit `secrets.STARS_TOKEN || secrets.GITHUB_TOKEN` fallthroughs as the auth decision. Run `pnpm auth:doctor` to print the active mode, capability matrix, and missing-config list (no secret values are printed).

**Critical invariant**: `repo_write_auth != star_fetch_auth`. The two roles use independent credential decisions because GitHub App installation tokens cannot enumerate `viewer.starredRepositories`.

| Mode            | Purpose                                       | Credential source                        | Status               |
|-----------------|-----------------------------------------------|------------------------------------------|----------------------|
| `github_app`    | preferred repo write / commit                 | `vars.GH_APP_CLIENT_ID` + `secrets.GH_APP_PRIVATE_KEY` | preferred       |
| `pat`           | authenticated user-star fetch                 | `secrets.STARS_TOKEN` (read:user scope)  | supported fallback   |
| `public`        | public-only star catalog                      | no token; `vars.STAR_SOURCE_USER`        | supported fallback   |
| `github_token`  | workflow identity fallback                    | built-in `secrets.GITHUB_TOKEN`          | degraded, loud       |
| `disabled`      | no usable path                                | none                                     | fail-fast            |

**Auto resolution priority** (when no `auth_mode` input is given):
1. `github_app` if both client id + private key present
2. `pat` if `STARS_TOKEN` present (degraded — App is preferred)
3. `public` if `STAR_SOURCE_USER` set
4. `github_token` if available (degraded — fetches the bot account's stars)
5. `disabled`

**App configuration**: when the App is installed and its credentials are present, `01-fetch` and `02-sync` mint short-lived installation tokens via `actions/create-github-app-token@v3` and use them for the commit/push step. Star fetch still uses `STARS_TOKEN` because installation tokens lack user context.

**Diagnostics**: every workflow that touches auth surfaces `auth_mode`, `star_source_user`, `star_fetch_auth`, `repo_write_auth`, `degraded` in `$GITHUB_STEP_SUMMARY`. If you see `auth_mode=disabled` or `degraded=true` and didn't expect it, the doctor's `missing_config` field names which key is absent.
