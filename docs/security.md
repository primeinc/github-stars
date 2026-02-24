# Security Documentation

This document describes the security measures and scanning tools configured for the GitHub Stars curation system.

## CodeQL Security Scanning

### Overview

The repository uses [GitHub CodeQL](https://codeql.github.com/) for static application security testing (SAST) to identify security vulnerabilities in the codebase. CodeQL is GitHub's industry-standard semantic code analysis engine that helps detect security issues before they reach production.

### Configuration

**Workflow File**: `.github/workflows/codeql.yml`

**Languages Analyzed**:
- JavaScript/TypeScript (includes .js, .jsx, .ts, .tsx files)

**Trigger Events**:
- **Push**: All branches (including main and feature branches)
- **Pull Request**: All branches
- **Schedule**: Weekly scan every Monday at 00:00 UTC

### Analysis Details

**Query Suite**: `security-extended`
- This suite includes all security queries plus additional quality checks
- Covers common vulnerabilities like:
  - SQL Injection
  - Cross-Site Scripting (XSS)
  - Path Traversal
  - Command Injection
  - Prototype Pollution
  - Insecure Randomness
  - Sensitive Data Exposure
  - And many more

**Build Process**:
The workflow installs all dependencies to ensure accurate analysis:
1. Root dependencies via `pnpm install`
2. Web dependencies via `npm ci` (in the `web/` directory)

### CI/CD Integration

**Failure Policy**: 
- CodeQL analysis results are uploaded to GitHub Security tab
- Detected vulnerabilities appear under **Security > Code scanning alerts**
- Critical/High severity issues should block merge until resolved
- Results are available in PR checks for review before merge

**Permissions**:
- `actions: read` - Read workflow artifacts
- `contents: read` - Checkout repository code
- `security-events: write` - Upload scan results to Security tab

### Viewing Results

1. **In Pull Requests**: CodeQL results appear as checks on the PR
2. **Security Tab**: Navigate to repository **Security > Code scanning alerts**
3. **Workflow Logs**: Detailed analysis logs available in Actions tab

### Testing the Scan

To test that CodeQL is working correctly:

1. Introduce a sample vulnerability (e.g., potential XSS in JavaScript)
2. Commit and push the code
3. Observe the CodeQL workflow running in GitHub Actions
4. Check that the workflow detects the vulnerability
5. View the alert in the Security tab

Example test vulnerability:
```javascript
// DO NOT COMMIT - Example vulnerability for testing only
function displayUserInput(input) {
  document.getElementById('output').innerHTML = input; // XSS vulnerability
}
```

### Maintenance

**Weekly Scans**: 
- Automated scans run weekly to catch newly disclosed vulnerabilities
- Query database is automatically updated by GitHub

**Query Updates**:
- CodeQL queries are maintained by GitHub and Microsoft Security Response Center
- Updates are applied automatically without workflow changes

### Response Process

When a vulnerability is detected:

1. **Review**: Check the alert details in Security tab
2. **Assess**: Determine severity and exploitability
3. **Fix**: Address the vulnerability in code
4. **Re-scan**: CodeQL will automatically re-scan on next push
5. **Verify**: Confirm the alert is resolved

### False Positives

If CodeQL reports a false positive:
1. Document the reason in a code comment
2. Dismiss the alert in the Security tab with justification
3. Consider using CodeQL query suppressions if recurring

### Resources

- [CodeQL Documentation](https://codeql.github.com/docs/)
- [GitHub Code Scanning](https://docs.github.com/en/code-security/code-scanning)
- [Security Best Practices](https://docs.github.com/en/code-security/getting-started)

## Additional Security Measures

### Dependency Scanning

GitHub Dependabot is enabled (default for public repos) to:
- Scan for known vulnerabilities in dependencies
- Automatically create PRs to update vulnerable packages

### Secret Scanning

GitHub Secret Scanning is enabled (default for public repos) to:
- Detect accidentally committed secrets
- Alert maintainers of exposed credentials

---

**Last Updated**: 2026-02-24
**Maintained By**: Security Team / Repository Maintainers
