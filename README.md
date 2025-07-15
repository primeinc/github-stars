# GitHub Stars Curation System

> An automated, AI-powered system for organizing and curating starred repositories using GitHub Actions and manifest-driven state management.

[![GitHub Actions](https://img.shields.io/badge/Powered%20by-GitHub%20Actions-blue)](https://github.com/features/actions)
[![AI Powered](https://img.shields.io/badge/AI-OpenAI%20GPT--4o-green)](https://openai.com/)
[![Schema Validated](https://img.shields.io/badge/Schema-JSON%20Validated-orange)](./schemas/repos-schema.json)

## 🌟 Overview

This repository contains an automated system that:

- **Fetches** all your starred repositories using GitHub's GraphQL API
- **Classifies** them using AI-powered categorization (OpenAI GPT-4o)
- **Organizes** them into a searchable, browsable structure
- **Maintains** a comprehensive manifest with rich metadata
- **Generates** documentation and README files automatically

Currently managing **1,079 repositories** across multiple categories and tags.

## 🏗️ System Architecture

The system operates through three main GitHub Actions workflows:

### 1. Fetch Stars (`01-fetch-stars.yml`)
- Uses GitHub GraphQL API to fetch all starred repositories
- Collects comprehensive metadata (language, topics, stars, etc.)
- Handles rate limiting and pagination automatically
- Stores results in `.github-stars/data/fetched-stars-graphql.json`

### 2. Sync Stars (`02-sync-stars.yml`)
- Compares fetched stars with existing manifest
- Adds new repositories to `repos.yml` manifest
- Removes repositories that are no longer starred
- Validates schema compliance

### 3. Curate Stars (`03-curate-stars.yml`)
- Uses AI to classify unclassified repositories
- Assigns categories, tags, and frameworks
- Validates classifications for quality
- Updates manifest with AI metadata and confidence scores

## 📊 Current Status

| Metric | Value |
|--------|-------|
| **Total Repositories** | 1,079 |
| **Classified** | 30 (2.8%) |
| **Unclassified** | 1,049 (97.2%) |
| **Schema Version** | 3.0.0 |
| **Last Updated** | 2025-07-15 |

## 🚀 Getting Started

### Prerequisites

- GitHub repository with Actions enabled
- Personal Access Token with `repo` and `read:user` permissions
- Optionally: Custom token stored as `STARS_TOKEN` secret for higher rate limits

### Setup

1. **Fork or clone this repository**
2. **Configure secrets** (optional):
   ```
   STARS_TOKEN: Your GitHub Personal Access Token
   ```
3. **Customize the manifest** (optional):
   - Edit taxonomy in `repos.yml` 
   - Adjust feature flags for your preferences
   - Modify batch sizes and automation settings

### Running the System

#### Automated (Recommended)
The system runs automatically daily at 3 AM UTC. No manual intervention required.

#### Manual Execution
You can trigger workflows manually:

```bash
# Fetch latest starred repositories
gh workflow run "Fetch GitHub Stars"

# Sync new repositories into manifest  
gh workflow run "Sync Starred Repos"

# Classify unclassified repositories (processes 10 at a time)
gh workflow run "Curate Starred Repos"
```

## 📁 Repository Structure

```
├── .github/
│   └── workflows/           # GitHub Actions workflows
│       ├── 01-fetch-stars.yml
│       ├── 02-sync-stars.yml
│       └── 03-curate-stars.yml
├── .github-stars/
│   ├── data/               # Runtime data storage
│   └── repos-template.yml  # Template for new manifests
├── docs/                   # Implementation documentation
├── queries/                # GraphQL queries
├── schemas/                # JSON schema validation
├── repos.yml              # Main manifest file (source of truth)
└── README.md              # This file
```

## 🏷️ Classification System

### Categories
Repositories are classified into functional categories:
- `dev-tools` - Development utilities and CLI tools
- `ui-libraries` - UI components and design systems  
- `frameworks` - Application frameworks and scaffolding
- `databases` - Database systems and related tools
- `productivity` - Productivity and workflow tools
- `learning` - Educational resources and tutorials
- `documentation` - Documentation tools and generators
- `automation` - CI/CD and automation tools
- `testing` - Testing frameworks and tools
- `deployment` - Deployment and infrastructure tools
- `monitoring` - Observability and monitoring
- `security` - Security tools and libraries
- `ai-ml` - AI and machine learning
- `data-science` - Data analysis and visualization
- `web-dev` - Web development tools
- `mobile-dev` - Mobile development
- `desktop-dev` - Desktop application development
- `game-dev` - Game development
- `embedded` - Embedded systems and IoT
- `networking` - Network tools and protocols
- `system-admin` - System administration
- `cloud` - Cloud platforms and services
- `containers` - Docker and container orchestration
- `apis` - API development and management

### Tags
Granular tags for enhanced discoverability:
- Language tags: `lang:rust`, `lang:js`, `lang:python`, etc.
- Technology tags: `cli`, `terminal`, `web-scraping`, etc.
- Feature tags: `cross-platform`, `real-time`, `offline-first`, etc.

### Frameworks
Specific framework detection when applicable:
- `react`, `vue`, `angular`, `svelte`
- `nextjs`, `nuxtjs`, `express`, `fastapi`
- `django`, `flask`, `rails`, `laravel`

## 🤖 AI Classification

The system uses OpenAI GPT-4o for intelligent repository classification:

### Classification Process
1. **Metadata Analysis**: Examines repository description, topics, language, and stars
2. **Category Assignment**: Assigns 1-3 relevant categories
3. **Tag Generation**: Creates 3-6 descriptive tags
4. **Framework Detection**: Identifies specific frameworks when applicable
5. **Validation**: Validates classifications against schema and taxonomy rules

### Quality Assurance
- **Schema Validation**: All classifications must pass JSON schema validation
- **Taxonomy Compliance**: Categories and tags must conform to allowed values
- **AI Validation**: Secondary AI pass validates and corrects classifications
- **Audit Trail**: Complete metadata about AI decisions and confidence scores

## 📝 Manual Classification

For repositories that AI cannot classify or need manual review:

1. **Edit repos.yml** directly:
   ```yaml
   - repo: "owner/repository-name"
     categories: ["dev-tools", "productivity"]  
     tags: ["cli", "terminal", "rust"]
     framework: null
     summary: "A description of what this tool does"
     needs_review: false
   ```

2. **Commit changes**: The system will validate and apply your classifications

3. **Use Issues**: Create issues with the `manual-classification` label for help

## 🔧 Configuration

### Feature Flags
Control system behavior via `feature_flags` in `repos.yml`:

```yaml
feature_flags:
  ai_sort: true                    # Enable AI classification
  ai_summarize_nondescript: true   # Generate summaries for poor READMEs
  batch_threshold: 10              # Process 10 repositories per batch
  auto_merge: false               # Require manual PR approval
  archive_handling: separate-directory  # How to handle archived repos
  enable_submodule_updates: false # Whether to actually clone repositories
```

### Customization
- **Taxonomy**: Add new categories and tags to the `taxonomy` section
- **Batch Size**: Adjust `batch_threshold` for processing speed vs. rate limits
- **AI Model**: Currently uses `openai/gpt-4o` (configurable in workflows)
- **Schedule**: Modify cron schedule in workflow files

## 🚨 Troubleshooting

### Common Issues

**Rate Limits**
- Solution: Configure `STARS_TOKEN` secret with higher rate limits
- The system handles rate limits gracefully and will resume

**Classification Failures**
- Check the Issues tab for auto-created classification failure issues
- Review AI responses in workflow logs
- Manually classify problematic repositories

**Schema Validation Errors**  
- Ensure all required fields are present
- Check that categories and tags conform to allowed values
- Validate YAML syntax

**Large Repository Collections**
- Increase `batch_threshold` carefully (max 100 for safety)
- Monitor workflow execution times
- Consider excluding archived repositories

### Getting Help

1. **Check workflow logs** in the Actions tab
2. **Review auto-created issues** for classification failures
3. **Validate your manifest** against the schema
4. **Open an issue** with the `help-wanted` label

## 🛠️ Development

### Schema Validation
```bash
# Install yq for YAML processing
wget -O yq https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64
chmod +x yq

# Validate manifest against schema
./yq eval '.' repos.yml > /dev/null  # Check YAML syntax
```

### Testing Workflows
```bash
# Test individual workflows
gh workflow run "Fetch GitHub Stars" 
gh workflow run "Sync Starred Repos"
gh workflow run "Curate Starred Repos" --field batch_limit=5
```

## 📈 Roadmap

- [ ] **Multi-axis Organization**: Generate browsable directory structure
- [ ] **README Generation**: Auto-generate category and tag READMEs  
- [ ] **Submodule Management**: Optional git submodule integration
- [ ] **Web Interface**: GitHub Pages dashboard for browsing
- [ ] **Relationship Mapping**: Detect and visualize repository relationships
- [ ] **Personal Ratings**: Add subjective quality ratings and notes
- [ ] **Usage Analytics**: Track which repositories you actually use
- [ ] **Export Options**: Generate reports in various formats

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with your own starred repositories
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- **GitHub Actions**: For providing the automation platform
- **OpenAI**: For AI-powered classification capabilities  
- **yq**: For YAML processing and manipulation
- **GitHub GraphQL API**: For efficient data fetching

---

*This system is actively maintained and processes repositories daily. Star this repository to add it to your own curation system! ⭐*