# AGENTS.md - GitHub Stars Curation System

This file contains instructions for AI agents (and human contributors) working on this codebase.

## 1. Project Overview
This is a **GitHub Actions-based automation system** for curating starred repositories.
- **Core Logic**: Embedded in `.github/workflows/*.yml` (JavaScript via `actions/github-script`).
- **Database**: `repos.yml` (YAML manifest). Two independent gates protect it: a **JSON Schema** gate (`schemas/repos-schema.json`) and a **taxonomy** gate (categories/tags must come from the closed set defined in `src/manifest/taxonomy.ts`).
- **Local Build**: A small TypeScript toolchain in `src/` is used in CI (`00-ci.yml`) and is runnable locally via `pnpm test`, `pnpm validate`, and `pnpm repro:taxonomy`.
- **Web Surface**: A Vite + React app under `web/` builds to `docs/` and is deployed to GitHub Pages by `04-build-site.yml`. A separate CI gate (`00b-web-ci.yml`) runs `npm ci`/`lint`/`build` on every PR + push to `main`.

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
- Unit tests: `pnpm test` (vitest, `vitest.config.ts`).
- Taxonomy validator: `pnpm validate` (runs `src/cli-validate.ts`).
- Taxonomy reproduction: `pnpm repro:taxonomy`.
- Normalizer: `pnpm normalize` (in-place canonicalization of `repos.yml`).
- The first three are what `.github/workflows/00-ci.yml` runs on every PR / push to `main`.

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
- `.github/workflows/`: Automation logic (numbered `00`–`05`, see §2).
- `schemas/repos-schema.json`: JSON Schema, source of truth for `repos.yml`.
- `queries/stars-query.graphql`: GraphQL query consumed by `01-fetch-stars`.
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
   │  graphql:`viewer { starredRepositories ... }` (queries/stars-query.graphql)
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

## 8. Token Model (star fetch)

`01-fetch-stars` uses `secrets.STARS_TOKEN || secrets.GITHUB_TOKEN`.

- `STARS_TOKEN` is a Personal Access Token with `read:user` scope, owned
  by the account whose stars you want to fetch. The default
  `GITHUB_TOKEN` belongs to the workflow's identity, which fetches
  stars for the wrong account in forks/orgs and may have insufficient
  scope.
- The workflow performs a `viewer { login }` auth probe up front. On
  `Bad credentials` it fails fast with a remediation message; transient
  5xx are retried with capped, jittered backoff.
- If `STARS_TOKEN` is missing, the workflow falls back to
  `GITHUB_TOKEN` and emits a warning in the job summary so the
  intentional vs. accidental fallback is visible in the run record.
