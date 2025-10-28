# GitHub Stars Curation System

An automated, AI-powered system for organizing and curating your GitHub starred repositories using GitHub Actions workflows.

## Overview

This project is a **100% free, GitHub-only solution** designed to be accessible to anyone with a GitHub account. No external services, hosting, or costs required.

It provides a comprehensive solution for managing your GitHub stars by:
- **Automatically fetching** your starred repositories using GitHub GraphQL API
- **Syncing changes** to a YAML manifest (`repos.yml`) as your single source of truth
- **AI-powered classification** using GitHub Models to categorize and tag repositories
- **Maintaining metadata** including topics, languages, licenses, and release information

**Key Principle**: Everything runs on GitHub's free tier—Actions, Pages, and Models—making this solution accessible to everyone.

## Current State

### ✅ Implemented Features

1. **Fetch Stars Workflow** (`01-fetch-stars.yml`)
   - Fetches all starred repositories via GraphQL API
   - Handles pagination and rate limiting gracefully
   - Stores comprehensive metadata (1079 repos currently tracked)
   - Supports both public and private stars (filters to public only)

2. **Sync Stars Workflow** (`02-sync-stars.yml`)
   - Identifies new and removed starred repositories
   - Updates the `repos.yml` manifest with new entries
   - Validates against JSON schema for consistency
   - Marks new repos for AI classification
   - Commits changes automatically with proper attribution

3. **AI Curation Workflow** (`03-curate-stars.yml`)
   - Uses GitHub Models (GPT-4o) for intelligent classification
   - Batch processing with configurable limits (default: 10 repos/run)
   - Two-stage AI validation to ensure quality
   - Auto-loops to process all unclassified repositories
   - Creates issues for failed classifications
   - Assigns categories, tags, and frameworks automatically

4. **Data Schema** (`schemas/repos-schema.json`)
   - Comprehensive JSON Schema validation
   - Supports rich metadata including:
     - Categories, tags, and frameworks
     - GitHub metadata (topics, languages, stars, license)
     - AI classification audit trail
     - Personal curation details
     - Repository relationships

### 📊 Current Statistics

- **1079** starred repositories tracked
- **Full metadata** including topics, languages, licenses
- **AI classification** system active and processing
- **Schema validation** ensuring data consistency

## Quick Start

### Prerequisites

- GitHub repository with Actions enabled
- GitHub Personal Access Token with `repo` and `read:user` scopes (optional, for private repos)

### Setup

1. **Fork or clone this repository**

2. **Configure secrets** (optional):
   ```
   STARS_TOKEN - GitHub Personal Access Token for enhanced permissions
   ```

3. **Run workflows manually**:
   - Go to Actions tab
   - Run `01-fetch-stars` to fetch your stars
   - Run `02-sync-stars` to update the manifest
   - Run `03-curate-stars` to classify repositories with AI

### Automated Workflow

The workflows can be chained together or run on a schedule:
- `01-fetch-stars`: Run manually or on schedule to fetch latest stars
- `02-sync-stars`: Auto-triggers or run manually to sync manifest
- `03-curate-stars`: Auto-triggers after sync or run manually to classify

## Architecture

### Workflow Sequence

```
┌─────────────────┐
│ Fetch Stars     │ ──> Fetches from GitHub API
│ (01)            │     Stores in .github-stars/data/
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Sync Stars      │ ──> Updates repos.yml manifest
│ (02)            │     Validates schema
└────────┬────────┘     Commits changes
         │
         ▼
┌─────────────────┐
│ Curate Stars    │ ──> AI classification (GPT-4o)
│ (03)            │     Batch processing
└─────────────────┘     Auto-loops until complete
```

### Data Flow

```
GitHub API
    │
    ▼
fetched-stars-graphql.json (temp)
    │
    ▼
repos.yml (source of truth)
    │
    ▼
AI Classification
    │
    ▼
Updated repos.yml with categories/tags
```

## File Structure

```
github-stars/
├── .github/
│   └── workflows/
│       ├── 01-fetch-stars.yml      # Fetch starred repos from GitHub
│       ├── 02-sync-stars.yml       # Sync to manifest
│       └── 03-curate-stars.yml     # AI classification
├── .github-stars/
│   ├── data/                       # Temporary data files (gitignored)
│   └── repos-template.yml          # Template for new manifest
├── docs/
│   ├── IMPLEMENTATION_PLAN.md      # Original implementation plan
│   ├── MVP_PLAN.md                 # MVP roadmap
│   └── COPILOT_SETUP.md           # GitHub Copilot setup guide
├── queries/
│   └── stars-query.graphql         # GraphQL query for fetching stars
├── schemas/
│   └── repos-schema.json           # JSON Schema for validation
└── repos.yml                       # Main manifest (1079 repos)
```

## Configuration

### Feature Flags (in `repos.yml`)

```yaml
feature_flags:
  ai_sort: true                      # Use AI for classification
  ai_summarize_nondescript: true     # Generate summaries for poor READMEs
  batch_threshold: 10                # Repos per AI batch
  auto_merge: false                  # Auto-merge PRs (not implemented yet)
  archive_handling: separate-directory  # How to handle archived repos
  enable_submodule_updates: false    # Submodule system (not implemented yet)
```

### Taxonomy (in `repos.yml`)

Controlled vocabulary for consistent classification:
- **43 categories**: dev-tools, ui-libraries, frameworks, databases, etc.
- **Flexible tags**: Language tags (lang:rust), descriptive tags (cli, terminal)
- **13 frameworks**: react, vue, angular, nextjs, etc.

## AI Classification

The system uses a sophisticated two-stage AI process:

1. **Classification Stage** (GPT-4o)
   - Analyzes repo metadata, topics, and description
   - Assigns 1-3 categories
   - Adds 3-6 descriptive tags
   - Identifies framework if applicable

2. **Validation Stage** (GPT-4o)
   - Validates classifications against schema
   - Fixes minor issues (case, formatting)
   - Rejects invalid classifications
   - Returns corrected JSON or rejection notice

### Example Classification

```json
{
  "repo": "microsoft/vscode",
  "categories": ["dev-tools", "productivity", "editors"],
  "tags": ["code-editor", "ide", "extensible", "electron", "lang:ts"],
  "framework": null
}
```

## Contributing

This is a personal repository organization system, but the architecture and workflows can be adapted for your own use.

### Design Philosophy

This project explores what's possible with a **100% GitHub-native solution**:
- ✅ **Zero Cost**: Runs entirely on GitHub's free tier
- ✅ **No External Services**: Everything stays within GitHub
- ✅ **Universally Accessible**: Anyone can fork and use immediately
- ✅ **GitHub Actions**: 100% automation without external scripts
- ✅ **GitHub Pages**: Free hosting for browsing interface
- ✅ **GitHub Models**: Free AI classification
- ✅ **No Build Dependencies**: Pure YAML + JavaScript

## Future Enhancements

See [MVP_PLAN.md](docs/MVP_PLAN.md) for detailed roadmap, including:
- **GitHub Pages web interface** for browsing and searching (static site, no external hosting)
- **README generation** for categories and tags (browsable directly on GitHub)
- **Enhanced search** and filtering (client-side JavaScript, no backend needed)
- **Scheduled automation** (built-in GitHub Actions cron)
- **Multi-axis organization** (by-category, by-tag, by-framework)

All planned features maintain the **100% GitHub-only** approach.

## License

This project structure and workflows are available for reuse and adaptation.

## Acknowledgments

- Built entirely with GitHub Actions and GitHub Models
- AI classification powered by OpenAI GPT-4o via GitHub Models
- Schema validation using cardinalby/schema-validator-action
- YAML processing with mikefarah/yq

---

**Status**: Active development | **Last Updated**: 2025-10-19 | **Repos Tracked**: 1079
