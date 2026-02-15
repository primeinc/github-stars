# Contributing to GitHub Stars

Thank you for your interest in contributing to the GitHub Stars curation system!

## Getting Started

### Prerequisites

This repository uses GitHub Actions for automation. For local development and validation, you'll need:

- **Git** (for version control)
- **[yq](https://github.com/mikefarah/yq)** (v4+) - YAML processor
- **[jq](https://stedolan.github.io/jq/)** - JSON processor
- **[Lefthook](https://github.com/evilmartians/lefthook)** (optional but recommended) - Git hooks manager
- **[ajv-cli](https://github.com/ajv-validator/ajv-cli)** (optional) - JSON Schema validator

### Installation

#### macOS

```bash
brew install yq jq lefthook
npm install -g ajv-cli
```

#### Linux (Ubuntu/Debian)

```bash
# Install yq
sudo wget -qO /usr/local/bin/yq https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64
sudo chmod +x /usr/local/bin/yq

# Install jq
sudo apt-get install jq

# Install lefthook
curl -fsSL https://github.com/evilmartians/lefthook/releases/latest/download/lefthook_linux_amd64 -o /usr/local/bin/lefthook
chmod +x /usr/local/bin/lefthook

# Install ajv-cli
npm install -g ajv-cli
```

#### Windows

```powershell
# Using Chocolatey
choco install yq jq

# Using Scoop
scoop install yq jq

# Install lefthook
scoop install lefthook

# Install ajv-cli
npm install -g ajv-cli
```

### Setting Up Git Hooks

After cloning the repository, install the Git hooks:

```bash
cd github-stars
lefthook install
```

This will set up pre-commit hooks that:
- Validate `repos.yml` against the JSON schema
- Check YAML and JSON syntax
- Prevent merge conflict markers from being committed
- Validate workflow files

## Repository Structure

```
github-stars/
├── .github/
│   └── workflows/          # GitHub Actions workflows
│       ├── 00-pr-validation.yml   # PR validation (NEW)
│       ├── 01-fetch-stars.yml     # Fetch starred repos
│       ├── 02-sync-stars.yml      # Sync to repos.yml
│       ├── 03-classify-repos.yml  # AI classification
│       ├── 04-build-site.yml      # Generate website
│       └── 05-generate-readmes.yml # Generate READMEs
├── categories/             # Category-specific README files
├── docs/                  # Documentation
├── queries/               # GraphQL queries
├── schemas/               # JSON Schemas (source of truth)
│   └── repos-schema.json  # Main manifest schema
├── scripts/               # Helper scripts
├── tags/                  # Tag-specific README files
├── web/                   # Website source
├── repos.yml              # Main repository manifest
├── lefthook.yml           # Git hooks configuration
└── AGENTS.md              # AI agent instructions
```

## Development Workflow

### Making Changes

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**:
   - Edit `repos.yml`, schemas, or workflows
   - Ensure changes follow the established patterns

3. **Validate locally** (automatic with Lefthook):
   ```bash
   # Manual validation if needed
   yq eval '.' repos.yml > /dev/null  # Check YAML syntax
   ajv validate -s schemas/repos-schema.json -d repos.yml  # Validate schema
   ```

4. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: descriptive commit message"
   ```
   
   The pre-commit hooks will automatically run validation.

5. **Push and create a PR**:
   ```bash
   git push origin feature/your-feature-name
   ```
   
   The `00-PR Validation` workflow will run automatically.

### Pull Request Requirements

All PRs must pass the following checks before merging:

- ✅ **Schema Validation**: `repos.yml` must conform to `schemas/repos-schema.json`
- ✅ **YAML Syntax**: All YAML files must have valid syntax
- ✅ **Category Consistency**: All categories must be defined in taxonomy
- ✅ **No Duplicates**: No duplicate or very similar category names
- ✅ **Workflow Validation**: GitHub Actions workflows must have valid syntax

## Code Style and Conventions

### YAML Style

- **Indentation**: 2 spaces
- **Naming**: Use `snake_case` for keys (e.g., `generated_at`, `total_repos`)
- **Comments**: Add explanatory comments for complex logic

### Category Naming

Categories must follow these rules:
- Use lowercase letters, numbers, and hyphens only
- Pattern: `^[a-z][a-z0-9-]*$`
- Length: 2-50 characters
- No duplicates or near-duplicates (e.g., don't have both `api` and `apis`)
- Be descriptive and specific

### JavaScript (in Workflows)

- **Format**: CommonJS for `actions/github-script`
- **Indentation**: 2 spaces
- **Semicolons**: Yes
- **Error Handling**: Use `try/catch` blocks
- **Logging**: Use `core.info()`, `core.warning()`, `core.error()`

## Common Tasks

### Adding a New Category

1. Add the category to `taxonomy.categories_allowed` in `repos.yml`:
   ```yaml
   taxonomy:
     categories_allowed:
       - existing-category
       - new-category  # Your new category
   ```

2. Ensure the category name follows the naming rules

3. Optionally create a README file: `categories/new-category.md`

4. Validate and commit

### Consolidating Categories

If you find duplicate or similar categories (e.g., `api`, `apis`, `ap-is`):

1. Choose the canonical name (usually the most descriptive)
2. Update `taxonomy.categories_allowed` in `repos.yml`
3. Update all repository entries to use the canonical name
4. Remove unused category files from `categories/`

### Modifying the Schema

1. Edit `schemas/repos-schema.json`
2. Update `schema_version` if breaking changes
3. Test with existing `repos.yml`
4. Document changes in PR description

## CI/CD Pipeline

### Workflow Execution Order

1. **00-PR Validation** (on PR) - Validates changes before merge
2. **01-Fetch Stars** (daily at 3 AM UTC) - Fetches starred repositories
3. **02-Sync Stars** (after fetch) - Syncs to `repos.yml`
4. **03-Classify Repos** (after sync) - AI classification
5. **04-Build Site** (after classify) - Generates website
6. **05-Generate READMEs** (after build) - Generates category/tag READMEs

### Preventing CI Failures

The new validation workflow (`00-pr-validation.yml`) prevents:
- Invalid YAML syntax
- Schema validation failures
- Inconsistent taxonomy
- Duplicate categories
- Invalid workflow files

This ensures that **no PR can be merged that would break the automation**.

## Troubleshooting

### Lefthook Hooks Not Running

```bash
# Reinstall hooks
lefthook uninstall
lefthook install

# Check installation
lefthook run pre-commit
```

### Schema Validation Fails

```bash
# Validate manually
ajv validate -s schemas/repos-schema.json -d repos.yml --strict=false

# Check syntax first
yq eval '.' repos.yml > /dev/null
```

### YAML Syntax Errors

```bash
# Use yq to check syntax
yq eval '.' repos.yml

# Convert to JSON to find errors
yq eval -o=json '.' repos.yml | jq .
```

## Best Practices

1. **Always validate before pushing** - Let Lefthook do its job
2. **Keep categories focused** - Avoid overly broad or narrow categories
3. **Use meaningful tags** - Tags should aid discovery
4. **Document changes** - Clear commit messages and PR descriptions
5. **Test locally** - Run validation commands before pushing
6. **Follow the schema** - The schema is the source of truth

## Getting Help

- 📖 Check [AGENTS.md](AGENTS.md) for AI agent instructions
- 📖 Check [README.md](README.md) for project overview
- 🐛 Open an issue for bugs or questions
- 💬 Discuss in pull requests

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
