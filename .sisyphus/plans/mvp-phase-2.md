# Work Plan: MVP Phase 2 - Content Generation (READMEs)

## Overview
Automate the generation of browsable README files for categories, tags, and an index page. This enables repository exploration directly through the GitHub web interface without needing an external site.

## Goals
- Create a new workflow `05-generate-readmes.yml`.
- Implement a generation script (embedded in workflow via `github-script`).
- Generate an main `README.md` index.
- Generate category-specific READMEs in `categories/`.
- Generate tag-specific READMEs in `tags/`.
- Ensure directory structure exists and is maintained.

## Proposed Changes

### 1. New Workflow: `.github/workflows/05-generate-readmes.yml`
- **Triggers**: 
  - `workflow_dispatch`
  - `workflow_run` (after `Generate Site Data` or `Curate Starred Repos` completes)
- **Steps**:
  - Checkout repository.
  - Setup `yq` (to parse `repos.yml`).
  - Use `actions/github-script` to:
    - Load `repos.yml` (via `yq` or direct JS parsing).
    - Iterate through taxonomy defined in `repos.yml`.
    - Generate Markdown content for:
      - `categories/CATEGORY_NAME.md`
      - `tags/TAG_NAME.md`
      - Main navigation/index section (possibly updating root `README.md` or a separate `INDEX.md`).
  - Commit and push changes.

### 2. Directory Structure
- `categories/`: Contains one `.md` file per category (e.g., `dev-tools.md`).
- `tags/`: Contains one `.md` file per tag (e.g., `rust.md`).

### 3. README Templates (Logic within `github-script`)
- **Index**: Table of contents for all categories and tags with counts.
- **Category/Tag Page**: 
  - Title and description (from taxonomy).
  - List of repositories (name, link, summary, stars, last updated).
  - Back to index link.

## Task Breakdown
- [ ] Research: Finalize Markdown template designs for category/tag pages.
- [ ] Infrastructure: Create `categories/` and `tags/` directories if missing.
- [ ] Workflow: Implement `05-generate-readmes.yml` logic.
- [ ] Scripting: Implement the `github-script` logic to parse `repos.yml` and write Markdown files.
- [ ] Integration: Ensure it triggers correctly after classification and site data generation.
- [ ] Validation: Verify Markdown links and formatting.

## Verification Plan
1. Manually trigger the workflow.
2. Check `categories/` and `tags/` for generated files.
3. Verify file content against `repos.yml`.
4. Check root `README.md` or `INDEX.md` for navigation links.

### 4. Template Research Findings
Research into existing "Awesome List" generators and README automation reveals several best practices we should adopt:
- **Table of Contents (TOC)**: Essential for navigation, especially with 40+ categories.
- **Badges**: Use badges for languages and recency (e.g., `lang:rust`, `Updated 1d ago`).
- **Grouping**: Group by category first, then sort by `starred_at` descending (to match the site default).
- **Metadata Tables**: For category pages, use a table format (Repo | Description | Stars | Last Updated) for better density.

### 5. Implementation Choice: Native Scripting
While external actions like `yaml-readme` are powerful, we will use **native `github-script`** to maintain our "Zero External Dependencies" core principle. This gives us full control over the multi-page generation logic (creating the `categories/` and `tags/` directories) without needing multiple specialized actions.

## Updated Task Breakdown
- [x] Research: Analyzed `readme-scribe`, `yaml-readme`, and `markdown-autodocs` patterns.
- [ ] Logic: Finalize the `github-script` JavaScript for:
    - Reading `repos.yml`.
    - Grouping by `categories`.
    - Grouping by `tags`.
    - Writing 50+ individual Markdown files.
- [ ] Templates: Finalize the Markdown string templates for Index and Category pages.
