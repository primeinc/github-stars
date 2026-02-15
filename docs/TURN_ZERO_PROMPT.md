# Turn 0 Optimal Prompt for GitHub Stars Curation System

## System Context Preload

You are working on the **GitHub Stars Curation System** - a GitHub Actions-based automation for curating and organizing starred repositories.

### Project Architecture

**Database:** `repos.yml` (YAML manifest validated against `schemas/repos-schema.json`)  
**Logic:** Embedded in `.github/workflows/*.yml` as JavaScript via `actions/github-script`  
**No Local Build:** All logic executes in GitHub Actions runners (Ubuntu latest)

### Core Workflows

1. **01-fetch-stars.yml** - Fetch starred repos via GitHub GraphQL API
2. **02-sync-stars.yml** - Sync metadata and detect changes
3. **03-classify-repos.yml** - AI classification using GPT-4o via `actions/ai-inference@v2`
4. **04-build-site.yml** - Generate static site (if applicable)
5. **05-generate-readmes.yml** - Generate category/tag pages and README.md

### Critical Constraints

- ✅ Zero external dependencies (free-tier GitHub Actions only)
- ✅ Idempotent workflows (safe to re-run)
- ✅ Schema validation before every commit (`cardinalby/schema-validator-action`)
- ✅ Cross-platform filenames (Windows, Linux, macOS compatible)

---

## Preloaded Documentation Context

### GitHub Actions Workflow Syntax

**Key Concepts:**
- **Triggers:** `on: push`, `on: workflow_dispatch`, `on: workflow_run`
- **Jobs:** Execute on `runs-on: ubuntu-latest`
- **Steps:** Sequential execution, use `uses:` for actions or `run:` for shell commands
- **Environment Variables:** 
  - Set at workflow/job/step level with `env:`
  - Access via `${{ env.VAR_NAME }}` in YAML or `$VAR_NAME` in shell
  - Persist across steps: `echo "VAR=value" >> $GITHUB_ENV`
- **Secrets:** Access via `${{ secrets.SECRET_NAME }}`

**Example Workflow Structure:**
```yaml
name: Example
on:
  push:
    branches: [main]
    paths: ['repos.yml']
  workflow_dispatch:

permissions:
  contents: write

jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
          
      - name: Run Script
        uses: actions/github-script@v8
        env:
          MY_VAR: ${{ secrets.MY_SECRET }}
        with:
          script: |
            const fs = require('fs');
            // JavaScript code here
            
      - name: Commit Changes
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add .
          git commit -m "Update [skip ci]"
          git push
```

### GitHub Script Action (actions/github-script)

**Pre-authenticated Octokit Client:**
```javascript
// Available in github-script context
const { github, context, core } = require('@actions/github');

// Access workflow context
core.info(`Event: ${context.eventName}`);
core.info(`Repo: ${context.repo.owner}/${context.repo.repo}`);
core.info(`SHA: ${context.sha}`);
core.info(`Actor: ${context.actor}`);

// REST API
const { data: pr } = await github.rest.pulls.get({
  owner: context.repo.owner,
  repo: context.repo.repo,
  pull_number: 123
});

// GraphQL API
const result = await github.graphql(`
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      issues(first: 5, states: OPEN) {
        nodes { title number }
      }
    }
  }
`, {
  owner: context.repo.owner,
  repo: context.repo.repo
});

// Create issue comment
await github.rest.issues.createComment({
  ...context.repo,
  issue_number: context.issue.number,
  body: '✅ Done!'
});

// Set outputs
core.setOutput('result', 'success');
core.setFailed('Error message'); // Fail the step
```

### JSON Schema Validation

**Key Keywords for repos-schema.json:**
```json
{
  "type": "object",
  "required": ["schema_version", "repositories"],
  "additionalProperties": false,
  "properties": {
    "repositories": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["repo", "categories", "tags"],
        "properties": {
          "categories": {
            "type": "array",
            "minItems": 1,
            "maxItems": 5,
            "uniqueItems": true,
            "items": { "type": "string" }
          },
          "tags": {
            "type": "array",
            "maxItems": 20,
            "uniqueItems": true,
            "items": {
              "type": "string",
              "pattern": "^([a-z]+:)?[a-z0-9][a-z0-9-]*$"
            }
          }
        }
      }
    }
  }
}
```

**Taxonomy Enforcement:**
- Categories MUST be in `taxonomy.categories_allowed` array
- Use `enum` or custom validation to enforce

---

## Available MCP Servers & Tools

### 1. github-mcp-server (Primary for this project)

**Repository Operations:**
- `get_file_contents` - Read files from any GitHub repo
- `get_commit` - Get commit details with diffs
- `list_branches`, `list_commits`, `list_issues`, `list_pull_requests`

**Search Operations:**
- `search_code` - Search code across all GitHub (use GitHub search syntax)
- `search_issues`, `search_pull_requests` - Search with filters
- `search_repositories`, `search_users`

**Pull Request Deep Dive:**
- `pull_request_read` - Methods: `get`, `get_diff`, `get_status`, `get_files`, `get_review_comments`, `get_reviews`, `get_comments`

**Web Search:**
- `web_search` - AI-powered web search with citations

**When to use:**
- Reading files from other repos for examples
- Searching for similar implementations
- Researching best practices
- Getting PR/issue context

### 2. windows-mcp (Desktop Automation)

**When to use:**
- Testing Windows-specific filename issues
- Automating desktop workflows
- Browser-based testing (use `Scrape-Tool`)

### 3. playwright-browser (Web Automation)

**When to use:**
- Testing GitHub UI interactions
- Scraping web pages for data
- Visual regression testing

### 4. context7 (Documentation Lookup)

**Two-step process:**
```
1. context7-resolve-library-id(libraryName, query) → returns /org/project
2. context7-query-docs(libraryId, query) → returns docs & code samples
```

**Available libraries (pre-resolved):**
- `/websites/github_en_actions` - GitHub Actions docs (6032 snippets)
- `/actions/toolkit` - GitHub Actions Toolkit (332 snippets)
- `/websites/github_en_rest` - GitHub REST API (7731 snippets)
- `/websites/json-schema_understanding-json-schema` - JSON Schema (127 snippets)

**When to use:**
- Need official API documentation
- Looking for code examples
- Verifying syntax/behavior

### 5. learndocs-microsoft (Microsoft Docs)

**Tools:**
- `microsoft_docs_search` - Search Microsoft Learn
- `microsoft_code_sample_search` - Find code samples by language
- `microsoft_docs_fetch` - Get full page content

**When to use:**
- Azure-related questions
- .NET/C# examples
- Official Microsoft guidance

---

## Common Patterns in This Repo

### Pattern 1: Load repos.yml with yq
```javascript
const fs = require('fs');
const { execSync } = require('child_process');

const yaml = fs.readFileSync('repos.yml', 'utf8');
const json = execSync('./yq eval -o=json -', { 
  input: yaml, 
  encoding: 'utf8', 
  maxBuffer: 50*1024*1024 
});
const data = JSON.parse(json);
const repos = data.repositories || [];
```

### Pattern 2: Safe Filename Sanitization
```javascript
const RESERVED_WINDOWS = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1'];

const sanitizeFilename = (text) => {
  // Handle namespaces (lang:python → lang-python)
  const match = text.match(/^([a-z]+):(.+)$/);
  if (match) {
    const [, ns, name] = match;
    const safeName = name.replace(/[<>"|?*\/\\]/g, '-')
                         .replace(/-+/g, '-')
                         .replace(/^-|-$/g, '');
    return `${ns}-${safeName}`;
  }
  
  let safe = text.replace(/[<>:"|?*\/\\]/g, '-')
                 .replace(/-+/g, '-')
                 .replace(/^-|-$/g, '');
  
  if (RESERVED_WINDOWS.includes(safe.toUpperCase())) {
    safe = `_${safe}`;
  }
  
  return safe;
};
```

### Pattern 3: Validate Against Taxonomy
```javascript
const allowedCategories = data.taxonomy.categories_allowed;
const safeCategories = (aiResult.categories || [])
  .filter(cat => allowedCategories.includes(cat))
  .slice(0, 5);

if (safeCategories.length === 0) {
  safeCategories.push('unclassified');
}
```

### Pattern 4: Retry Logic for Git Operations
```javascript
for (let i = 1; i <= 5; i++) {
  git pull --rebase --autostash origin main
  git push && break || sleep 10
done
```

---

## Quick Reference: Key Files

- `repos.yml` - Source of truth (generated by workflows)
- `schemas/repos-schema.json` - JSON Schema v3.0.0
- `.github/workflows/03-classify-repos.yml` - AI classification logic
- `.github/workflows/05-generate-readmes.yml` - File generation logic
- `AGENTS.md` - Custom instructions for AI agents (this file!)
- `categories/*.md` - Generated category pages
- `tags/*.md` - Generated tag pages
- `README.md` - Generated index

---

## Asking for Help

**DO:**
- ✅ Use `gh` CLI for GitHub operations
- ✅ Use `github-mcp-server` tools for research
- ✅ Use `context7` for official documentation
- ✅ Check `AGENTS.md` for project-specific rules
- ✅ Validate with schema before committing

**DON'T:**
- ❌ Install npm/pip packages (use GitHub Actions only)
- ❌ Create local build systems
- ❌ Modify schema version without migration plan
- ❌ Skip validation steps
- ❌ Use forward slashes on Windows (`C:/path` → `C:\path`)

---

## Example Turn 0 Usage

**User:** "I need to add taxonomy validation to workflow 03"

**You (with this context):**
1. Read `.github/workflows/03-classify-repos.yml`
2. Check `schemas/repos-schema.json` for `taxonomy.categories_allowed`
3. Reference Pattern 3 above for implementation
4. Use `context7-query-docs('/websites/github_en_actions', 'workflow validation')` if needed
5. Edit the file with taxonomy enforcement
6. Commit and push

**Efficient because:**
- No need to ask "what's the project about?"
- No need to search for documentation
- Patterns are pre-loaded
- Tool usage is clarified

---

## Success Metrics

A well-executed Turn 0 prompt enables:
- ⚡ **Faster responses** - No discovery phase needed
- 🎯 **Accurate solutions** - Context-aware from the start
- 🔧 **Right tools** - Know which MCP server to use
- 📚 **Documentation-backed** - Code samples pre-loaded
- 🛡️ **Safe changes** - Constraints and patterns understood

---

*Last Updated: 2026-01-29*  
*For AI Agents working on primeinc/github-stars*
