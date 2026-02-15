# Sandboxing & Deployment Strategy

## Overview

This document outlines the complete sandboxing strategy to prevent branch workflows from affecting production systems, data, and deployments.

## The Foundational Problem

When workflows run on feature branches, they can:

1. **Deploy to production** (GitHub Pages, etc.)
2. **Commit generated content** to main (README.md, categories/, tags/)
3. **Overwrite data files** (repos.yml)
4. **Create race conditions** between multiple branches
5. **Pollute artifacts** with branch-specific builds

## Sandboxing Layers

### Layer 1: Data Modification Protection ✅

**Workflows that modify repos.yml and core data**

| Workflow | Protection | Status |
|----------|-----------|--------|
| 01-fetch-stars | Branch check + Runtime verification | ✅ Implemented |
| 02-sync-stars | Branch check + Runtime verification | ✅ Implemented |
| 03-classify-repos | Branch check + Runtime verification | ✅ Implemented |

**Implementation:**
```yaml
jobs:
  job-name:
    if: github.ref == 'refs/heads/main' || github.event_name == 'workflow_dispatch'
```

```bash
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "⚠️  Not on main branch - skipping commit"
  exit 0
fi
```

### Layer 2: Generated Content Protection ✅

**Workflow: 05-generate-readmes**

Generates README.md, categories/*, tags/* from repos.yml

**Current Protection:**
- Branch check + Runtime verification
- Only commits to main branch

**Potential Improvement:** Use a `gh-pages-source` branch for generated content

### Layer 3: Deployment Protection ⚠️ 

**Workflow: 04-build-site**

Builds React app and deploys to GitHub Pages

**Current Protection:**
```yaml
deploy:
  if: github.ref == 'refs/heads/main'
```

**Issue:** Build step still runs on all branches, wasting resources

**Recommendation:** Separate build validation from production deployment

### Layer 4: Artifact Isolation 🔴 NEEDS IMPROVEMENT

**Current State:**
- Artifacts use branch-specific names: `fetched-stars-${{ github.run_id }}`
- But `.github-stars/data/` directory is shared

**Problem:** Branch workflows write to `.github-stars/data/` which could conflict

**Recommendation:** Use branch-specific directories

## Improved Architecture

### Option A: Branch-Specific Data Directories (Simple)

```yaml
env:
  DATA_DIR: .github-stars/data/${{ github.ref_name }}

- name: Setup
  run: mkdir -p $DATA_DIR
```

**Pros:**
- Easy to implement
- Full isolation
- No conflicts

**Cons:**
- More disk space
- Need cleanup

### Option B: Ephemeral Artifacts Only (Recommended)

**For branch workflows:**
- Don't write to `.github-stars/data/`
- Use GitHub Actions artifacts exclusively
- Only main branch writes to filesystem

**Implementation:**
```yaml
- name: Save results
  if: github.ref != 'refs/heads/main'
  uses: actions/upload-artifact@v6
  with:
    name: branch-results-${{ github.ref_name }}
    path: /tmp/results.json
```

### Option C: Staging Branch for Generated Content

Create a deployment flow:

```
main (source data)
  ↓
  → workflows process
  ↓
gh-pages-source (generated content)
  ↓
  → build & deploy
  ↓
gh-pages (production site)
```

**Benefits:**
- Clear separation of concerns
- Can review generated content before deploy
- Easy rollback

## Recommended Implementation Plan

### Phase 1: Artifact Isolation ✅ (Current PR)

```yaml
# In all workflows
- name: Setup data directory
  run: |
    if [ "${{ github.ref }}" == "refs/heads/main" ]; then
      DATA_DIR=".github-stars/data"
    else
      DATA_DIR="/tmp/github-stars-${{ github.run_id }}"
    fi
    mkdir -p "$DATA_DIR"
    echo "DATA_DIR=$DATA_DIR" >> $GITHUB_ENV
```

Then use `$DATA_DIR` throughout the workflow instead of hardcoded paths.

### Phase 2: Deployment Sandboxing (High Priority)

Update `04-build-site.yml`:

```yaml
jobs:
  validate-build:
    runs-on: ubuntu-latest
    if: github.ref != 'refs/heads/main'  # Only run on branches
    steps:
      - name: Build site (validation only)
        run: npm run build
      - name: Note
        run: echo "✅ Build validated. Not deploying from branch."

  build-and-deploy:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'  # Only run on main
    steps:
      - name: Build and deploy
        # ... full build and deploy steps
```

### Phase 3: Generated Content Strategy (Future)

Consider moving generated content to a separate branch:

1. Main branch: Source of truth (repos.yml, schemas, workflows)
2. `generated` branch: Generated READMEs and markdown files
3. `gh-pages` branch: Built website

**Workflow:**
```yaml
- name: Commit to generated branch
  if: github.ref == 'refs/heads/main'
  run: |
    git checkout -B generated
    git add README.md categories/ tags/
    git commit -m "docs: update generated content"
    git push origin generated
```

## Testing the Sandboxing

### Test 1: Branch Workflow Isolation

```bash
# Create test branch
git checkout -b test/sandbox

# Trigger workflow manually
gh workflow run 01-fetch-stars.yml --ref test/sandbox

# Check that main is unchanged
git checkout main
git log -1  # Should not show new commits
```

### Test 2: Artifact Isolation

```bash
# Run workflow on branch
gh workflow run 02-sync-stars.yml --ref test/sandbox

# Check artifacts
gh run list --workflow=02-sync-stars.yml
gh run view <run-id> --log
# Should show: "Not on main branch - skipping commit"
```

### Test 3: Deployment Protection

```bash
# Create a branch and push
git checkout -b test/deploy
git push origin test/deploy

# Trigger build workflow
gh workflow run 04-build-site.yml --ref test/deploy

# Verify deploy job was skipped
gh run view --log
# Should show: deploy job skipped due to ref check
```

## Security Considerations

### Secrets in Branch Workflows

**Risk:** Branch workflows could expose secrets if not careful

**Mitigation:**
```yaml
env:
  # Don't expose sensitive tokens on branches
  STARS_TOKEN: ${{ github.ref == 'refs/heads/main' && secrets.STARS_TOKEN || '' }}
```

### Pull Request from Forks

**Risk:** Fork PRs run workflows with limited permissions (this is good)

**Current State:** PR validation only runs read-only checks ✅

**Action Required:** None - GitHub's default fork PR restrictions are sufficient

### Branch Protection Rules

Required settings in GitHub UI:

```yaml
Settings → Branches → Branch protection rules for 'main':
  ☑ Require status checks to pass before merging
    - validate (from 00-PR Validation)
  ☑ Require branches to be up to date before merging
  ☑ Require linear history
  ☑ Include administrators
```

## Monitoring & Alerts

### What to Monitor

1. **Unexpected commits from workflows**
   ```bash
   git log --all --author="github-actions" --since="1 day ago" --branches=* | grep -v main
   ```

2. **Workflow runs on non-main branches**
   ```bash
   gh run list --json headBranch,conclusion | jq '.[] | select(.headBranch != "main")'
   ```

3. **Artifact disk usage**
   ```bash
   gh api repos/:owner/:repo/actions/cache/usage
   ```

### Alerts to Set Up

1. **Notify on branch commits**: If any workflow commits to a non-main branch
2. **Deployment failures**: If deploy job fails
3. **Validation failures**: If PR validation fails

## Cleanup & Maintenance

### Artifact Cleanup

GitHub automatically deletes:
- Artifacts after 90 days (default)
- Workflow runs after 400 days

**Manual cleanup:**
```bash
# Delete old artifacts
gh api repos/:owner/:repo/actions/artifacts --paginate | \
  jq -r '.artifacts[] | select(.expired == false) | .id' | \
  xargs -I {} gh api -X DELETE repos/:owner/:repo/actions/artifacts/{}
```

### Branch Cleanup

```bash
# Delete stale branches (older than 30 days)
git branch -r --merged main | \
  grep -v "main\|gh-pages" | \
  sed 's/origin\///' | \
  xargs -I {} git push origin --delete {}
```

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-15 | Implement branch checks in all data workflows | Prevent data corruption |
| 2026-02-15 | Add runtime verification to commits | Defense in depth |
| 2026-02-15 | Use ephemeral directories for branch builds | Artifact isolation |
| 2026-02-15 | Keep deploy check in 04-build-site | Already implemented |
| TBD | Decide on generated content strategy | Need more data on commit frequency |

## Future Considerations

### Preview Environments

For complex changes, consider:

1. **Deploy previews for PRs**: Use Vercel/Netlify for PR previews
2. **Diff-based reviews**: Show what changed in generated content
3. **Staging deployment**: Deploy to a staging site before production

### Workflow Orchestration

As complexity grows, consider:

1. **Workflow templates**: Reusable workflow components
2. **Custom actions**: Encapsulate common patterns
3. **Workflow dependencies**: Better control of execution order

### Cost Management

Monitor GitHub Actions minutes:

```bash
gh api /repos/:owner/:repo/actions/workflows | \
  jq '.workflows[] | {name, state, created_at}'
```

Optimize:
- Cache dependencies aggressively
- Skip redundant steps
- Use matrix builds sparingly

## Conclusion

The sandboxing strategy is **multi-layered** and **defense-in-depth**:

1. ✅ **Workflow-level**: `if:` conditions prevent branch runs
2. ✅ **Runtime-level**: Branch checks in commit steps
3. ✅ **Deployment-level**: Separate deploy job with ref check
4. 🔧 **Artifact-level**: Use ephemeral directories (implementing)
5. 🔧 **Review-level**: PR validation catches issues (implementing)

**Status:** 
- Core protections implemented ✅
- Artifact isolation in progress 🔧
- Advanced features planned 📋

---

**Last Updated:** 2026-02-15  
**Next Review:** 2026-03-15  
**Owner:** DevOps Team
