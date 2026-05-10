# AGENTS.md - GitHub Stars Curation System

This file contains instructions for AI agents (and human contributors) working on this codebase.

## 1. Project Overview
This is a **GitHub Actions-based automation system** for curating starred repositories.
- **Core Logic**: Embedded in `.github/workflows/*.yml` (JavaScript via `actions/github-script`).
- **Database**: `repos.yml` (YAML manifest), validated against `schemas/repos-schema.json`.
- **Local Build**: A small TypeScript toolchain in `src/` is used in CI (`00-ci.yml`) and is runnable locally via `pnpm test`, `pnpm validate`, and `pnpm repro:taxonomy`.

## 2. Build, Test, and Validation
Two layers of validation exist: local TypeScript tests (`vitest`) and Actions-side schema validation.

### Local toolchain (Node / pnpm)
- Install: `pnpm install` (lockfile is `pnpm-lock.yaml`).
- Unit tests: `pnpm test` (vitest, `vitest.config.ts`).
- Manifest validator: `pnpm validate` (runs `src/cli-validate.ts` against `schemas/repos-schema.json`).
- Taxonomy reproduction: `pnpm repro:taxonomy`.
- These same three commands are what `.github/workflows/00-ci.yml` runs on every PR / push to `main`.

### Schema Validation
The primary correctness check is JSON Schema validation for `repos.yml`.
- **Schema**: `schemas/repos-schema.json`
- **Validation Tool**: `cardinalby/schema-validator-action` (in CI workflows 02/04) or local `pnpm validate` / `ajv-cli` if installed.
- **Test Command** (Manual):
  ```bash
  pnpm validate
  # or, if you have ajv-cli installed
  ajv validate -s schemas/repos-schema.json -d repos.yml
  ```

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

## 4. AI & Copilot Rules (from docs/COPILOT_SETUP.md)

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
- `.github/workflows/`: Automation logic.
- `schemas/`: JSON Schemas (Source of Truth).
- `docs/`: Documentation.
- `queries/`: GraphQL queries for GitHub API.
- `scripts/`: Helper scripts (if any).
- `repos.yml`: The database (generated/updated by Actions).

## 6. Critical Constraints
- **Zero External Dependencies**: Logic must run in standard GitHub Actions runners.
- **Free Tier**: Do not introduce paid dependencies or services.
- **Idempotency**: Workflows should be safe to re-run.
