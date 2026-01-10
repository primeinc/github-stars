# GitHub Stars Curation System

An automated system for organizing starred GitHub repositories using GitHub Actions, AI classification, and schema-driven data management.

## Overview

This project provides a 100% free, GitHub-native solution for managing starred repositories. All features run on GitHub's free tier (Actions, Pages, Models) with no external dependencies or costs.

**Core Features:**
- Automated repository fetching via GraphQL API
- AI-powered classification using GitHub Models (GPT-4o)
- Schema-validated YAML manifest as single source of truth
- Comprehensive metadata tracking (topics, languages, licenses, releases)

## Architecture

### Workflows

**01-fetch-stars.yml**
- Fetches starred repositories using GitHub GraphQL API
- Handles pagination and rate limiting
- Currently tracking 1,079 repositories
- Filters to public repositories only

**02-sync-stars.yml**
- Identifies new and removed repositories
- Updates `repos.yml` manifest
- Validates against JSON Schema
- Auto-commits changes with proper attribution

**03-curate-stars.yml**
- Classifies repositories using GitHub Models (GPT-4o)
- Batch processing (default: 10 repos per run)
- Two-stage AI validation
- Auto-loops until all repositories classified
- Creates issues for validation failures

### Data Schema

The `schemas/repos-schema.json` file defines:
- Repository metadata structure
- Category and tag taxonomies
- AI classification audit trail
- GitHub metadata preservation


## Quick Start

### Prerequisites

- GitHub repository with Actions enabled
- GitHub Personal Access Token with `repo` and `read:user` scopes (optional, for private repositories)

### Setup

1. Fork or clone this repository
2. Configure secrets (optional): Add `STARS_TOKEN` for enhanced permissions
3. Run workflows manually via Actions tab:
   - `01-fetch-stars` to fetch your starred repositories
   - `02-sync-stars` to update the manifest
   - `03-curate-stars` to classify repositories

### Workflow Sequence

```
GitHub API → Fetch Stars → repos.yml → Sync Stars → AI Classification → Updated repos.yml
```

## Configuration

### Feature Flags (in repos.yml)

```yaml
feature_flags:
  ai_sort: true                      # Use AI for classification
  ai_summarize_nondescript: true     # Generate summaries for poor READMEs
  batch_threshold: 10                # Repos per AI batch
  auto_merge: false                  # Auto-merge PRs (not implemented)
  archive_handling: separate-directory
  enable_submodule_updates: false    # Submodule system (not implemented)
```

### Taxonomy

Controlled vocabulary defined in `repos.yml`:
- 43 categories: dev-tools, ui-libraries, frameworks, databases, etc.
- Flexible tags: Language tags (lang:rust), descriptive tags (cli, terminal)
- 13 frameworks: react, vue, angular, nextjs, etc.

## AI Classification

The system uses a two-stage process with GitHub Models (GPT-4o):

1. **Classification**: Analyzes metadata, assigns 1-3 categories, adds 3-6 tags, identifies framework
2. **Validation**: Validates classifications, fixes formatting issues, returns corrected JSON or rejection

Example output:
```json
{
  "repo": "microsoft/vscode",
  "categories": ["dev-tools", "productivity", "editors"],
  "tags": ["code-editor", "ide", "extensible", "electron", "lang:ts"],
  "framework": null
}
```

## Design Principles

This project demonstrates a feature-complete solution using only GitHub's free tier:
- GitHub Actions for automation (unlimited minutes for public repos)
- GitHub Pages for web hosting (planned)
- GitHub Models for AI classification (free tier)
- No external services or costs required
- Universally accessible to anyone with a GitHub account

## Documentation

- [MVP Plan](docs/MVP_PLAN.md) - Roadmap to completion
- [Current State](docs/CURRENT_STATE.md) - Technical assessment
- [Copilot Setup](docs/COPILOT_SETUP.md) - Setup guide for contributors
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md) - Original vision

## Contributing

This is designed as a personal repository organization system. Fork and adapt for your own use. The architecture and workflows are freely reusable.

## Acknowledgments

Built with GitHub Actions, GitHub Models (GPT-4o), cardinalby/schema-validator-action, and mikefarah/yq.
