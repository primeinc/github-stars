# GitHub Advanced Security Setup Guide

This guide is for repository administrators who need to enable GitHub Advanced Security features.

## Overview

This repository uses **Gitleaks** (open-source) for secret scanning in CI/CD. Additionally, GitHub offers native **GitHub Advanced Security** which provides:
- Real-time secret scanning on push
- Push protection (blocks commits with secrets before they're pushed)
- Partner pattern detection
- Integration with GitHub Security tab

## Enabling GitHub Advanced Security

### For Public Repositories (FREE)
GitHub Advanced Security is **free for public repositories**.

### For Private Repositories
GitHub Advanced Security requires a GitHub Enterprise Cloud or Enterprise Server license.

## Step-by-Step Setup

### 1. Enable Secret Scanning

1. Navigate to the repository on GitHub
2. Click **Settings** (requires admin access)
3. In the left sidebar, click **Security & analysis**
4. Scroll to **Secret scanning**
5. Click **Enable** next to "Secret scanning"

### 2. Enable Push Protection (Recommended)

Push protection prevents secrets from being pushed to the repository in the first place.

1. In the same **Security & analysis** section
2. Find **Push protection**
3. Click **Enable**

**What this does:**
- Blocks git pushes that contain detected secrets
- Provides immediate feedback to developers
- Prevents secrets from ever entering the repository history

### 3. Configure Secret Scanning Alerts

1. Go to **Settings** → **Security & analysis**
2. Under **Secret scanning**, click **Configure**
3. Set notification preferences:
   - Email notifications for detected secrets
   - Security advisories
   - Dependency alerts

### 4. Review Security Tab

After enabling secret scanning:
1. Go to the **Security** tab in your repository
2. Click **Secret scanning** to see any detected secrets
3. Review and resolve any alerts

## CI/CD Integration

Our CI workflows (`.github/workflows/00-ci.yml`) already include:
- Gitleaks secret scanning
- Automatic blocking of PRs with detected secrets
- Detailed logs for investigation

The CI integration works alongside GitHub Advanced Security for defense-in-depth:
- **Gitleaks** (CI): Scans on PR/push, blocks merge
- **GitHub Secret Scanning** (Native): Real-time scanning, partner patterns
- **Push Protection** (Native): Blocks secrets before push

## Verification

After enabling GitHub Advanced Security:

1. **Check Security Tab**: Visit the Security tab to confirm secret scanning is active
2. **Test Detection** (optional):
   - Create a test branch
   - Try to commit a dummy secret (marked as TEST)
   - Verify push protection blocks it (if enabled)
   - Delete the test branch

3. **Review Existing Alerts**: Check if any secrets were detected in repository history

## Partner Patterns

GitHub Advanced Security includes detection patterns for:
- AWS credentials (Access Keys, Secret Keys)
- Azure credentials
- Google Cloud credentials
- Stripe API keys
- Slack tokens
- GitHub tokens
- And 150+ more partner patterns

See: https://docs.github.com/en/code-security/secret-scanning/secret-scanning-patterns

## Handling Alerts

When a secret is detected:

1. **Verify the finding**: Check if it's a real secret or false positive
2. **For real secrets**:
   - **Rotate immediately**: Generate new credentials
   - **Revoke the old credential**
   - **Update all systems** using the credential
   - **Remove from git history** (if needed)
3. **For false positives**:
   - Close the alert with a reason
   - Add to `.gitleaks.toml` allowlist if needed

## Organization-Level Settings

For GitHub Organizations, you can:
1. Enable secret scanning for all repositories
2. Set organization-wide policies
3. Configure default notification settings
4. View security dashboard across all repos

**Organization Settings** → **Security & analysis** → Enable organization-wide settings

## Resources

- [GitHub Secret Scanning Documentation](https://docs.github.com/en/code-security/secret-scanning)
- [Push Protection Documentation](https://docs.github.com/en/code-security/secret-scanning/push-protection-for-repositories-and-organizations)
- [Secret Scanning Patterns](https://docs.github.com/en/code-security/secret-scanning/secret-scanning-patterns)
- [About GitHub Advanced Security](https://docs.github.com/en/get-started/learning-about-github/about-github-advanced-security)

## Support

For issues with GitHub Advanced Security:
- Check GitHub's [status page](https://www.githubstatus.com/)
- Review [GitHub Support](https://support.github.com/) documentation
- Contact GitHub Support (for Enterprise customers)

For issues with Gitleaks in CI:
- Check `.github/workflows/00-ci.yml`
- Review logs in GitHub Actions
- See `docs/security.md` for troubleshooting
