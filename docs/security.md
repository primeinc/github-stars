# Security & Compliance

## CodeQL Static Analysis

GitHub CodeQL runs on every push and pull request across all branches, plus a weekly scheduled scan (Monday 6am UTC).

### Coverage

- **Languages:** JavaScript, TypeScript
- **Query suite:** `security-and-quality` (includes OWASP Top 10, CWE coverage, and code quality checks)
- **Trigger:** Push (all branches), PR (all branches), weekly schedule

### How It Works

1. CodeQL initializes with the `javascript-typescript` language pack
2. Autobuild detects and compiles the TypeScript project
3. Analysis runs the `security-and-quality` query suite
4. Results are uploaded to the Security tab as SARIF alerts

### Blocking Behavior

- PRs with detected vulnerabilities will show CodeQL alerts in the Security tab
- Repository admins can configure branch protection rules to require CodeQL checks to pass before merge

### Viewing Results

- **Security tab** → Code scanning alerts
- **PR checks** → CodeQL analysis status
- **Actions tab** → Workflow run logs with detailed scan output

### Adding New Languages

If the project adds languages beyond JS/TS (e.g., Python, Go), update the `language` matrix in `.github/workflows/codeql.yml`:

```yaml
matrix:
  language: ['javascript-typescript', 'python']
```

### False Positives

Document false positives in code with `// codeql-suppress` comments or in a `.github/codeql/codeql-config.yml` file. Track false positive triage in a dedicated issue.
