# Branch Protection Guide

## Critical: Preventing Data Corruption from Branch Workflows

This document explains how we protect the `main` branch from data corruption while still validating PRs.

## The Problem (and Initial Wrong Solution)

**Problem 1:** Branch workflows could push changes directly to `main`, causing:
- Race conditions between branches
- Data corruption
- Merge conflicts

**Problem 2:** Skipping workflows on branches means:
- ❌ Broken code passes PR review (no validation!)
- ❌ Gets merged to main
- ❌ Workflow fails on main
- ❌ **Main branch is now broken!**

## The Correct Solution

**✅ Workflows MUST run on all branches** (for validation)  
**✅ But only COMMIT/DEPLOY from main branch** (for safety)

This achieves:
- ✅ PRs are validated before merge
- ✅ Broken code is caught in PR review
- ✅ Main branch never receives invalid commits
- ✅ No data corruption from branch workflows

### 1. Dual-Mode Workflow Execution

All data-modifying workflows now run in **two modes**:

**Validation Mode (on branches):**
```yaml
jobs:
  job-name:
    runs-on: ubuntu-latest
    # Run on ALL branches for validation
```

```bash
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "⚠️  VALIDATION MODE - Skipping commit"
  echo "✅ Workflow validated successfully"
  exit 0  # Success, but no commit
fi
```

**Production Mode (on main):**
```bash
if [ "$CURRENT_BRANCH" == "main" ]; then
  echo "✅ PRODUCTION MODE - Committing changes"
  git commit && git push
fi
```

This ensures:
- ✅ PRs are tested (workflows run)
- ✅ PRs pass validation before merge
- ✅ Only main commits actual changes

### 2. Runtime Branch Verification

All commit steps include a safety check:

```bash
# SAFETY: Only commit if we're on main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "⚠️  Not on main branch ($CURRENT_BRANCH) - skipping commit to prevent data corruption"
  exit 0
fi
```

This provides a runtime safeguard even if the workflow runs on a branch.

### 3. Concurrency Controls

All workflows use global concurrency groups:

```yaml
concurrency:
  group: workflow-name  # Not workflow-name-${{ github.ref }}
  cancel-in-progress: false
```

This ensures only **one instance** of each workflow runs at a time across all branches.

### 4. PR Validation Workflow

The `00-PR Validation` workflow runs on PRs to validate changes **before** they reach `main`:

- Schema validation
- YAML syntax checking
- Category consistency
- No duplicate categories

## Protected Workflows

The following workflows are protected and will **only modify data on main branch**:

| Workflow | Purpose | Protection Level |
|----------|---------|------------------|
| `01-fetch-stars.yml` | Fetch starred repos | ✅ Branch check + Runtime verification |
| `02-sync-stars.yml` | Sync to repos.yml | ✅ Branch check + Runtime verification |
| `03-classify-repos.yml` | AI classification | ✅ Branch check + Runtime verification |
| `04-build-site.yml` | Build website | ✅ Branch restriction (push: branches: [main]) |
| `05-generate-readmes.yml` | Generate READMEs | ✅ Branch check + Runtime verification |

## GitHub Branch Protection Settings

To fully protect the repository, configure these settings in GitHub:

### Required Settings

1. **Navigate to**: Settings → Branches → Add rule for `main`

2. **Enable**:
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
     - Required checks:
       - `validate` (from 00-PR Validation workflow)
   - ✅ Require conversation resolution before merging
   - ✅ Do not allow bypassing the above settings

3. **Optional but Recommended**:
   - ✅ Require linear history (prevents merge commits)
   - ✅ Include administrators (applies rules to admins too)

### Configuration via GitHub CLI

```bash
gh api repos/{owner}/{repo}/branches/main/protection -X PUT --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["validate"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
EOF
```

## Testing Branch Protection

To verify the protection works:

1. **Create a test branch**:
   ```bash
   git checkout -b test/branch-protection
   ```

2. **Make a change to repos.yml**:
   ```bash
   echo "# test" >> repos.yml
   git commit -am "test: branch protection"
   git push origin test/branch-protection
   ```

3. **Manually trigger a workflow**:
   - Go to Actions → Select a workflow → Run workflow
   - Select your test branch
   - The workflow should either:
     - Not run (due to branch check)
     - Run but skip the commit step (due to runtime verification)

4. **Expected output**:
   ```
   ⚠️  Not on main branch (test/branch-protection) - skipping commit to prevent data corruption
   Changes would be committed, but branch protection prevents this.
   ```

5. **Verify main is unchanged**:
   ```bash
   git checkout main
   git pull
   # Your test changes should NOT be in main
   ```

## Workflow Dispatch Safety

Even when manually triggering workflows via `workflow_dispatch`, the protection works:

- If triggered from a branch → workflow skips commit
- If triggered from main → workflow commits normally

## Developer Guidelines

### DO ✅

- Create feature branches for changes
- Test workflows locally before pushing (use Lefthook)
- Create PRs that pass validation
- Manually trigger workflows from `main` branch only when needed

### DON'T ❌

- Don't bypass branch protection
- Don't manually trigger data workflows from feature branches
- Don't commit directly to main (use PRs)
- Don't disable the safety checks in workflows

## Monitoring

To monitor if protection is working:

1. **Check workflow runs**:
   ```bash
   gh run list --workflow=01-fetch-stars.yml
   ```

2. **Look for safety messages**:
   - Any run showing "Not on main branch" indicates protection is working
   - All commits should come from main branch runs

3. **Audit commits**:
   ```bash
   git log --all --graph --decorate --oneline
   # All automated commits should be on main
   ```

## Emergency Procedures

If data corruption occurs despite protections:

1. **Identify the corrupted commit**:
   ```bash
   git log --oneline repos.yml
   ```

2. **Revert to last known good state**:
   ```bash
   git checkout <good-commit-sha> -- repos.yml
   git commit -m "fix: restore repos.yml from <good-commit-sha>"
   ```

3. **Validate the restored file**:
   ```bash
   ajv validate -s schemas/repos-schema.json -d repos.yml
   ```

4. **Create an incident report** documenting:
   - What caused the corruption
   - Which workflow bypassed protection
   - How to prevent it in the future

## Architecture Decision

### Why This Approach?

We chose multiple layers of protection because:

1. **Defense in Depth**: If one layer fails, others catch it
2. **Fail-Safe**: Workflows default to safe behavior (skip, don't error)
3. **Visibility**: Clear logging when protection activates
4. **Flexibility**: Manual dispatch still works for testing

### Alternatives Considered

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Only use branch protection | Simple | Doesn't prevent manual dispatch from branches | ❌ Not sufficient |
| Disable workflows on branches | Complete protection | Can't test workflows in PRs | ❌ Too restrictive |
| Current multi-layer approach | Flexible, safe, visible | More complex | ✅ **Chosen** |

## Future Improvements

Potential enhancements to consider:

1. **Separate read-only workflows**: Allow validation workflows on branches
2. **PR preview environments**: Deploy branch changes to preview without affecting main
3. **Automated rollback**: Auto-revert if validation fails post-merge
4. **Workflow monitoring**: Alert on unexpected branch runs

---

**Last Updated**: 2026-02-15  
**Maintainer**: GitHub Actions Team  
**Status**: Active Protection ✅
