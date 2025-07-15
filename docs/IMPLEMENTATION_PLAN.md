# GitHub Stars Curation System - Final Implementation Plan

## Executive Summary

A fully automated, GitHub-native system for organizing and curating starred repositories using a manifest-driven approach, AI-powered classification, and git submodules for multi-axis organization. The system operates entirely within GitHub's ecosystem using Actions, native AI inference, and proven third-party actions.

## Core Architecture

### 1. Manifest-Driven State Management (`repos.yml`)

The single source of truth containing all repository metadata, classifications, and system configuration:

```yaml
schema_version: "1.0"
feature_flags:
  ai_sort: true                    # Use AI for classification
  ai_summarize_nondescript: true   # Generate summaries for poor READMEs
  batch_threshold: 10              # Process in batches of 10
  auto_merge: false               # Require manual PR approval initially

repositories:
  - repo: "owner/name"
    categories: ["dev-tools", "productivity"]
    tags: ["cli", "rust", "terminal", "cross-platform"] 
    framework: null
    summary: "Auto-generated summary of what this tool does"
    last_synced_sha: "abc123..."
    starred_at: "2025-01-15T10:30:00Z"
    readme_quality: "good|poor|missing"
    needs_review: false
```

### 2. Multi-Axis Organization Structure

```
github-stars/
├── .github/
│   ├── workflows/
│   │   ├── curate-stars.yml          # Main workflow
│   │   ├── ci-validation.yml         # PR checks
│   │   └── error-recovery.yml        # Issue-triggered fixes
│   ├── ISSUE_TEMPLATE/
│   │   ├── classification-error.md
│   │   └── sync-failure.md
│   └── labeler.yml                   # Auto-labeling config
├── by-category/
│   ├── dev-tools/
│   │   ├── README.md                 # Auto-generated
│   │   ├── tokei/                    # → submodule
│   │   └── yq/                       # → submodule
│   └── ui-libraries/
│       ├── README.md
│       └── rizzui/                   # → submodule
├── by-tag/
│   ├── rust/
│   │   ├── README.md
│   │   └── tokei/                    # → submodule (same repo, different location)
│   └── react/
│       ├── README.md
│       └── rizzui/                   # → submodule
├── by-framework/
│   └── react/
│       ├── README.md
│       └── rizzui/                   # → submodule
├── templates/
│   ├── category-readme.md.tpl        # Markscribe templates
│   ├── tag-readme.md.tpl
│   └── index-readme.md.tpl
├── schemas/
│   └── repos-schema.json             # JSON Schema for validation
├── repos.yml                         # Manifest (source of truth)
└── README.md                         # Auto-generated index
```

## Implementation Components

### Phase 1: Core Workflow Infrastructure

#### 1.1 Main Curation Workflow (`.github/workflows/curate-stars.yml`)

```yaml
name: 'Curate Starred Repos'
on:
  schedule:
    - cron: '0 3 * * *'  # Daily at 3 AM UTC
  workflow_dispatch:
    inputs:
      force_full_sync:
        description: 'Force processing all repos'
        type: boolean
        default: false

permissions:
  contents: write
  pull-requests: write
  issues: write
  models: read        # For AI inference

jobs:
  sync-and-classify:
    runs-on: ubuntu-latest
    outputs:
      repos_to_process: ${{ steps.diff.outputs.repos }}
      manifest_updated: ${{ steps.diff.outputs.changed }}
```

**Key integrations:**
- **actions/github-script**: Fetch starred repos via Octokit
- **actions/cache**: Cache based on manifest hash
- **yq**: Read/update YAML manifest
- **actions/ai-inference**: Classify repositories

#### 1.2 AI Classification Pipeline

Using the native GitHub AI inference action discovered in our research:

```yaml
- name: Classify Repository Batch
  uses: actions/ai-inference@v1
  with:
    model: 'openai/gpt-4.1'
    system-prompt-file: 'templates/classification-prompt.txt'
    prompt: |
      Analyze these repositories and return JSON with categories, tags, and summaries:
      ${{ steps.batch.outputs.repo_data }}
    max-tokens: 2000
```

**Fallback strategy**: If AI fails, create issue for manual classification

#### 1.3 Repository Structure Generation

Using **actions/github-script** for complex git operations:

```javascript
// Nuke and pave approach for idempotency
await exec.exec('git rm -rf by-category by-tag by-framework');
await exec.exec('rm -f .gitmodules');

// Read manifest and generate structure
const manifest = yaml.load(fs.readFileSync('repos.yml'));
for (const repo of manifest.repositories) {
  // Add submodule to each applicable location
  for (const category of repo.categories) {
    await exec.exec(`git submodule add --name ${repo.repo.replace('/', '-')}-cat-${category} https://github.com/${repo.repo} by-category/${category}/${repo.repo.split('/')[1]}`);
  }
}
```

### Phase 2: Documentation Generation

#### 2.1 README Generation with Markscribe

Using **readme-scribe** with custom templates:

```yaml
- uses: muesli/readme-scribe@master
  with:
    template: "templates/category-readme.md.tpl"
    writeTo: "by-category/${{ matrix.category }}/README.md"
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    CATEGORY: ${{ matrix.category }}
```

Template example (`category-readme.md.tpl`):
```markdown
# {{ .Env.CATEGORY | title }}

{{ $repos := filterReposByCategory .Manifest.Repositories .Env.CATEGORY }}
Total repositories: {{ len $repos }}

## Repositories

{{ range $repos }}
### [{{ .Name }}](https://github.com/{{ .Repo }})
{{ .Summary }}

**Tags**: {{ join .Tags ", " }}
**Stars**: {{ with repo (split .Repo "/")[0] (split .Repo "/")[1] }}{{ .Stargazers }}{{ end }}
{{ end }}
```

### Phase 3: Error Handling & Recovery

#### 3.1 Structured Issue Creation

Using **dacbd/create-issue-action** with templates:

```yaml
- name: Create Classification Error Issue
  if: failure()
  uses: dacbd/create-issue-action@main
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    title: '🚨 Classification Failed: ${{ matrix.repo }}'
    body: |
      ## Automated Classification Failed
      
      **Repository**: ${{ matrix.repo }}
      **Error**: ${{ steps.classify.outputs.error }}
      
      ### Manual Classification Needed
      Please add the following to `repos.yml`:
      ```yaml
      - repo: "${{ matrix.repo }}"
        categories: []  # Add categories
        tags: []        # Add tags
        summary: ""     # Add summary
      ```
    labels: needs-manual-classification, ai-failure
```

#### 3.2 Issue-Triggered Recovery Workflow

```yaml
name: 'Manual Classification Handler'
on:
  issues:
    types: [labeled, edited]

jobs:
  process-manual-classification:
    if: contains(github.event.label.name, 'manual-classification-complete')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/github-script@v7
        with:
          script: |
            // Parse YAML from issue body
            const issueBody = context.payload.issue.body;
            const yamlMatch = issueBody.match(/```yaml\n([\s\S]+?)\n```/);
            // Update manifest and trigger main workflow
```

### Phase 4: Validation & Quality Assurance

#### 4.1 Schema Validation

Using **cardinalby/schema-validator-action**:

```yaml
- name: Validate Manifest Schema
  uses: cardinalby/schema-validator-action@v3
  with:
    schema: 'schemas/repos-schema.json'
    file: 'repos.yml'
    mode: 'strict'
```

#### 4.2 PR Validation Workflow

```yaml
name: 'PR Validation'
on:
  pull_request:
    paths:
      - 'repos.yml'
      - 'by-*/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Check manifest integrity
      - name: Verify submodule structure
      - name: Validate generated READMEs
      - name: Check for orphaned entries
```

### Phase 5: Advanced Features

#### 5.1 Batch Processing with Dynamic Matrices

```yaml
- name: Generate Processing Matrix
  id: matrix
  uses: actions/github-script@v7
  with:
    script: |
      const repos = ${{ steps.diff.outputs.repos }};
      const batchSize = ${{ env.BATCH_SIZE }};
      const batches = [];
      for (let i = 0; i < repos.length; i += batchSize) {
        batches.push(repos.slice(i, i + batchSize));
      }
      return { batches };

process-batch:
  needs: prepare
  strategy:
    matrix:
      batch: ${{ fromJson(needs.prepare.outputs.matrix).batches }}
```

#### 5.2 Submodule Management

Using **runsascoded/update-submodules** for efficient updates:

```yaml
- name: Update All Submodules
  uses: runsascoded/update-submodules@latest
  with:
    mode: 'remote'  # Update to latest commits
    config: |
      [submodule]
        fetchJobs = 8  # Parallel fetching
```

## Migration Path

### Week 1: Foundation
1. Create manifest schema and initial `repos.yml`
2. Implement basic sync workflow
3. Set up schema validation

### Week 2: AI Integration
1. Configure AI inference action
2. Create classification prompts
3. Implement fallback issue creation

### Week 3: Structure Generation
1. Implement submodule management
2. Create README templates
3. Set up documentation generation

### Week 4: Polish & Automation
1. Enable auto-merge with branch protection
2. Create error recovery workflows
3. Add monitoring and metrics

## Key Improvements Over Original Gemini Pro Design

1. **Real GitHub AI**: Using `actions/ai-inference` instead of fictional Models API
2. **Proven Actions**: Leveraging well-maintained actions from our research
3. **Markscribe Templates**: Better documentation generation than custom scripts
4. **YQ for YAML**: Cleaner manifest manipulation than Python/JS scripts
5. **Issue-Driven Recovery**: More structured error handling
6. **Batch Processing**: Smarter grouping to avoid rate limits

## Success Metrics

- ✅ All 1071 public starred repos categorized and organized
- ✅ Zero manual intervention after initial setup (if auto_merge enabled)
- ✅ Daily updates capturing new stars
- ✅ Rich documentation for each category/tag
- ✅ Full audit trail via git history
- ✅ Graceful failure handling with issue creation

## Next Steps

1. Create the manifest schema file
2. Write the main workflow YAML
3. Design the Markscribe templates
4. Test with a subset of repos
5. Enable full automation