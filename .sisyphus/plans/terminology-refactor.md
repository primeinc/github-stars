# Work Plan: Terminology and Timestamp Clarity Refactor

## Overview
Rename confusing timestamp fields to be unique, concise, and self-describing. This resolves the "updated today - what was?" ambiguity by clearly distinguishing between when a user starred a repo, when the repo was pushed to GitHub, and when the manifest was last synced.

## Proposed Terminology Changes

| Current Name | Proposed Name | Description |
|--------------|---------------|-------------|
| `starred_at` | `user_starred_at` | When the user starred the repository. |
| `github_metadata.updated_at` | `repo_pushed_at` | When the repository was last pushed to on GitHub. |
| `manifest_metadata.last_updated` | `manifest_updated_at` | When the manifest file was last modified by the automation. |
| `ai_classification.timestamp` | `classified_at` | When the AI classification was performed. |

## Affected Components

### 1. Schema (`schemas/repos-schema.json`)
- Update property names and descriptions to match new terminology.

### 2. Workflows
- **01-fetch-stars.yml**: Update the JS object mapping from GraphQL response to JSON.
- **02-sync-stars.yml**: Update the sync logic to use new field names when merging metadata.
- **03-classify-repos.yml**: Update the filtering and update logic.

### 3. Frontend (`docs/app.js` & `docs/index.html`)
- Update data accessors (e.g., `repo.starred_at` -> `repo.user_starred_at`).
- Update UI labels:
  - "Updated [date]" -> "Pushed: [date]"
  - Add "Starred: [date]" to the cards/rows for better context.

### 4. Data (`repos.yml`)
- Perform a global search-and-replace to migrate existing data to the new schema.

## Task Breakdown
- [ ] Update JSON Schema with new field names.
- [ ] Refactor `01-fetch-stars.yml` to produce the new field names.
- [ ] Refactor `02-sync-stars.yml` to handle the new field names during sync.
- [ ] Refactor `03-classify-repos.yml` to use the new field names.
- [ ] Update `docs/app.js` to use the new field names for sorting and display.
- [ ] Update `docs/index.html` (and CSS if needed) to display both Starred and Pushed dates clearly.
- [ ] Migrate `repos.yml` data.

## Verification Plan
1. Validate `repos.yml` against the updated schema.
2. Run the `01-fetch-stars` workflow and verify the output JSON structure.
3. Verify the site displays "Starred: [date]" and "Pushed: [date]" correctly.
4. Confirm `adriangalilea/namecheap-python` shows the correct "Starred" date at the top of the list.
