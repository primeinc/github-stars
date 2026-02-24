# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this repository, please report it by:

1. **DO NOT** open a public issue
2. **DO NOT** commit the vulnerability details to the repository
3. Send details privately to the repository maintainers via:
   - GitHub Security Advisories: Use the "Security" tab → "Report a vulnerability"
   - Or open a private discussion with maintainers

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will respond as quickly as possible and work with you to address the issue.

## Security Measures

This repository implements the following security controls:

### Secret Scanning
- **Automated scanning** via Gitleaks runs on every push and pull request
- **CI blocking**: PRs with detected secrets cannot be merged
- **Full git history scanning**: Detects secrets in commit history
- **Documentation**: See [docs/security.md](docs/security.md) for details

### GitHub Advanced Security (Recommended)
- For public repositories: Free secret scanning and push protection available
- For private repositories: Requires GitHub Enterprise license
- Setup guide: [docs/github-advanced-security-setup.md](docs/github-advanced-security-setup.md)

### Best Practices
1. Never commit credentials, API keys, or secrets
2. Use GitHub Secrets for CI/CD workflows
3. Rotate any accidentally exposed credentials immediately
4. Review commits before pushing
5. Use `.gitignore` for sensitive files

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |

We only maintain the `main` branch. Security fixes will be applied directly to `main`.

## Security-Related Documentation

- [Security Documentation](docs/security.md) - Comprehensive security guide for developers
- [GitHub Advanced Security Setup](docs/github-advanced-security-setup.md) - Admin setup guide
- [Gitleaks Configuration](.gitleaks.toml) - Secret scanning configuration

## Acknowledgments

We appreciate responsible disclosure and will acknowledge security researchers who report valid vulnerabilities (with permission).

## Contact

For security-related questions not related to vulnerabilities, please open a discussion in the repository.
