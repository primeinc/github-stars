# AGENTS.md - GitHub Stars Curation System

This file contains instructions for AI agents (and human contributors) working on this codebase.

## 1. Project Overview
This is a **GitHub Actions-based automation system** for curating starred repositories.
- **Core Logic**: Embedded in `.github/workflows/*.yml` (JavaScript via `actions/github-script`).
- **Database**: `repos.yml` (YAML manifest), validated against `schemas/repos-schema.json`.
- **No Local Build**: There is no `npm build` or `npm test`. Logic is executed via GitHub Actions.

## 2. Build, Test, and Validation
Since this is an Actions-first repo, "testing" implies validating schemas or running scripts conceptually.

### Schema Validation
The primary correctness check is JSON Schema validation for `repos.yml`.
- **Schema**: `schemas/repos-schema.json`
- **Validation Tool**: `cardinalby/schema-validator-action` (in CI) or local `ajv-cli` if installed.
- **Test Command** (Manual):
  ```bash
  # If you have ajv-cli installed
  ajv validate -s schemas/repos-schema.json -d repos.yml
  ```

### Running Workflows
- Workflows are numbered: `01-fetch-stars`, `02-sync-stars`, `03-curate-stars`.
- Trigger manually via GitHub Actions tab.

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
