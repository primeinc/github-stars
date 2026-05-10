# Security & Compliance

## CodeQL Static Analysis

GitHub CodeQL runs on every push to `main` and every pull request targeting `main`, plus a weekly scheduled scan (Monday 06:00 UTC).

This is the canonical "advanced setup" trigger pattern — see [GitHub's advanced-setup how-to](https://docs.github.com/en/code-security/code-scanning/creating-an-advanced-setup-for-code-scanning/configuring-advanced-setup-for-code-scanning) ("analyze your code each time you either push a change to the default branch or any protected branches, or raise a pull request against the default branch"). Running on every push to every branch (the original PR #39 pattern) burns Actions minutes on dependabot/* and feature branches without a PR-feedback benefit.

### Coverage

- **Languages:** JavaScript, TypeScript
- **Query suite:** `security-and-quality` (OWASP Top 10, CWE coverage, code-quality checks). Stricter than the default suite; trade-off is slightly higher false-positive volume.
- **Trigger:** push to `main`, PR against `main`, weekly schedule.

### How It Works

1. CodeQL initializes with the `javascript-typescript` language pack
2. Analysis runs the `security-and-quality` query suite
3. Results are uploaded to the Security tab as SARIF alerts

(Note: there is no `autobuild` step. JS/TS is interpreted; the canonical starter for interpreted languages omits the autobuild stage.)

### Blocking Behavior

- PRs with detected vulnerabilities surface CodeQL alerts in the Security tab and inline in the PR review.
- Repository admins can configure branch protection rules to require CodeQL checks to pass before merge.

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

For compiled languages (Java, C#, C/C++, Swift, Go), you must add an `autobuild` step OR set `build-mode: manual` and provide explicit build commands. See [the canonical starter](https://github.com/actions/starter-workflows/blob/main/code-scanning/codeql.yml).

### False Positives

Suppress in code with the documented CodeQL [pragma comments](https://docs.github.com/en/code-security/code-scanning/managing-code-scanning-alerts/managing-code-scanning-alerts-for-your-repository#dismissing-or-deleting-alerts), or via a `.github/codeql/codeql-config.yml` file. Track false-positive triage in a dedicated issue.

### Why advanced setup, not default setup

GitHub recommends [default setup](https://docs.github.com/en/code-security/code-scanning/managing-your-code-scanning-configuration/evaluating-default-setup-for-code-scanning) (one-click in repo Settings → Code security) for most projects. This repo uses the advanced setup (a workflow file) so the trigger pattern, query suite, and matrix are version-controlled and reviewable in PRs alongside the code they protect.
