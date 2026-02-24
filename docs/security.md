# Security

This document outlines the security measures and practices implemented in the GitHub Stars Curation System.

## Secret Scanning

### Overview
Secret scanning is integrated into our CI/CD pipeline to prevent accidental exposure of sensitive information such as API keys, tokens, and credentials.

### Implementation
We use [Gitleaks](https://github.com/gitleaks/gitleaks) for automated secret detection:
- **Workflow**: `.github/workflows/00-ci.yml`
- **Trigger**: Runs on every push and pull request to the `main` branch
- **Scope**: Scans entire repository history and current files
- **Action**: CI fails if secrets are detected, preventing merge

### How It Works
1. The `secret-scanning` job runs in parallel with other CI checks
2. Gitleaks scans all files and git history for known secret patterns
3. If secrets are found:
   - The job fails with detailed logs
   - The PR/push is blocked from merging
   - Details are logged for investigation
4. If no secrets are found, the job passes

### Handling Detected Secrets

#### If Gitleaks Detects a Secret:
1. **Review the findings**: Check the GitHub Actions logs for details about what was detected
2. **Verify if it's a real secret**:
   - **True positive**: Immediately revoke/rotate the exposed credential
   - **False positive**: Add to `.gitleaks.toml` allowlist (see below)
3. **Remove the secret from git history**:
   ```bash
   # For recent commits not yet pushed:
   git rebase -i HEAD~n  # where n is number of commits
   # Edit the commit to remove the secret
   
   # For commits already pushed (requires force push):
   # Use git-filter-repo or BFG Repo-Cleaner
   # See: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository
   ```
4. **Push the cleaned history**: Once the secret is removed and rotated

#### Configuring False Positives
If Gitleaks flags something that isn't actually a secret, create a `.gitleaks.toml` configuration file:

```toml
title = "gitleaks config"

# Add paths to ignore
[allowlist]
paths = [
    # Example: ignore test fixtures with dummy secrets
    '''fixtures/.*''',
]

# Add specific commits to ignore
commits = [
    # Example: "abcdef1234567890"
]

# Add regex patterns to ignore
regexes = [
    # Example: ignore UUIDs that look like secrets
    '''[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}''',
]
```

### GitHub Advanced Security

#### Native Secret Scanning
GitHub provides native secret scanning as part of GitHub Advanced Security:
- **Free for public repositories**
- **Paid feature for private repositories**

To enable:
1. Go to repository **Settings** → **Security & analysis**
2. Enable **Secret scanning**
3. (Optional) Enable **Push protection** to block commits with secrets
4. Configure notification settings

#### Benefits of GitHub Advanced Security:
- Real-time scanning on push
- Prevents secrets from being committed (with push protection)
- Partner pattern detection (tokens from AWS, Azure, Google Cloud, etc.)
- Integrated with GitHub Security tab
- Automatic alerts and notifications

### Best Practices

1. **Never commit secrets**:
   - Use environment variables for sensitive data
   - Use GitHub Secrets for CI/CD workflows
   - Use secret management tools (HashiCorp Vault, AWS Secrets Manager, etc.)

2. **Use `.gitignore`**:
   ```
   .env
   .env.local
   *.key
   *.pem
   secrets.yml
   config/credentials.yml
   ```

3. **Review before committing**:
   ```bash
   git diff --cached  # Review staged changes before committing
   ```

4. **Rotate exposed secrets immediately**:
   - Assume any committed secret is compromised
   - Revoke and generate new credentials
   - Update all systems using the old credential

5. **Use short-lived credentials** where possible

### Testing Secret Scanning

To verify secret scanning is working:

1. **DO NOT commit real secrets for testing**
2. Instead, check the GitHub Actions logs after a PR/push
3. To test detection (carefully):
   - Create a test branch
   - Add a dummy secret (clearly marked as fake)
   - Push and verify Gitleaks catches it
   - Delete the test branch immediately

Example dummy secret (for testing only):
```bash
# TEST_ONLY: This is not a real secret
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
```

### Resources
- [Gitleaks Documentation](https://github.com/gitleaks/gitleaks)
- [GitHub Secret Scanning Documentation](https://docs.github.com/en/code-security/secret-scanning)
- [Removing Sensitive Data from Repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [Microsoft Security Development Lifecycle](https://www.microsoft.com/en-us/securityengineering/sdl)

### Support
If you have questions about secret scanning or need help with a detected secret:
1. Check the GitHub Actions logs for details
2. Review this documentation
3. Open an issue with the security team (do not include the actual secret)
