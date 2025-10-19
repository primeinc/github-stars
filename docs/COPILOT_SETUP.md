# GitHub Copilot Setup Guide

This document outlines the steps required to set up GitHub Copilot for working with the `github-stars` project. It covers prerequisites, installation, configuration, and best practices.

## Overview

This project is designed to work seamlessly with **GitHub Copilot** for:
- Writing and maintaining GitHub Actions workflows
- Generating documentation
- Creating classification prompts for AI
- Extending the schema and taxonomy
- Building web interfaces and search functionality

## Prerequisites

### 1. GitHub Copilot Subscription

You need an active GitHub Copilot subscription:

- **Individual Plan**: $10/month or $100/year
- **Business Plan**: $19/user/month
- **Enterprise Plan**: Contact GitHub sales

**Get Started**: https://github.com/features/copilot

#### For Students and Open Source Maintainers

- **GitHub Global Campus**: Free Copilot for verified students
- **Open Source**: Some programs offer free access for maintainers

### 2. Supported IDE/Editor

GitHub Copilot is available for:

- ✅ **Visual Studio Code** (Recommended for this project)
- ✅ **Visual Studio**
- ✅ **JetBrains IDEs** (IntelliJ, PyCharm, WebStorm, etc.)
- ✅ **Neovim** (via plugin)
- ✅ **Vim** (via plugin)

**Recommendation**: Use **VS Code** for best integration with GitHub Actions and YAML files.

### 3. Git and GitHub CLI

Ensure you have:
- Git installed and configured
- GitHub account with repository access
- GitHub CLI (`gh`) for advanced features (optional but recommended)

```bash
# Install GitHub CLI (optional)
# macOS
brew install gh

# Windows
winget install GitHub.cli

# Linux
sudo apt install gh
```

## Installation

### VS Code Setup (Recommended)

1. **Install VS Code**
   - Download from https://code.visualstudio.com/

2. **Install GitHub Copilot Extension**
   ```
   Extensions > Search "GitHub Copilot" > Install
   ```
   Or direct link: https://marketplace.visualstudio.com/items?itemName=GitHub.copilot

3. **Install Additional Extensions** (Recommended)
   ```
   - GitHub Copilot Chat (companion to Copilot)
   - YAML (Red Hat) - for workflow editing
   - GitHub Actions (GitHub) - workflow intellisense
   - JSON Schema (Red Hat) - schema validation
   - Markdown All in One - documentation editing
   ```

4. **Authenticate GitHub Copilot**
   - Open VS Code
   - Sign in to GitHub when prompted
   - Authorize Copilot access

5. **Verify Installation**
   - Open any file (e.g., `.github/workflows/01-fetch-stars.yml`)
   - Start typing a comment, Copilot should suggest code
   - Check status bar for Copilot icon (should be active)

### JetBrains IDEs Setup

1. **Open IDE** (IntelliJ IDEA, PyCharm, WebStorm, etc.)

2. **Install Plugin**
   ```
   Settings/Preferences > Plugins > Marketplace > Search "GitHub Copilot" > Install
   ```

3. **Restart IDE**

4. **Sign in to GitHub**
   - Tools > GitHub Copilot > Sign in to GitHub

5. **Verify Installation**
   - Open any code file
   - Start typing, watch for Copilot suggestions

### Neovim/Vim Setup

1. **Install Copilot.vim Plugin**
   ```vim
   " Using vim-plug
   Plug 'github/copilot.vim'
   
   " Or using Packer
   use 'github/copilot.vim'
   ```

2. **Authenticate**
   ```vim
   :Copilot setup
   ```

3. **Verify**
   - Open any file
   - Start typing in insert mode
   - Press `<Tab>` to accept Copilot suggestions

## Configuration for This Project

### VS Code Workspace Settings

Create or update `.vscode/settings.json` in the project root:

```json
{
  "github.copilot.enable": {
    "*": true,
    "yaml": true,
    "markdown": true,
    "json": true,
    "javascript": true
  },
  "github.copilot.advanced": {
    "debug.overrideChatEngine": "gpt-4"
  },
  "yaml.schemas": {
    "./schemas/repos-schema.json": "repos.yml"
  },
  "yaml.customTags": [
    "!include",
    "!reference"
  ],
  "editor.quickSuggestions": {
    "other": true,
    "comments": true,
    "strings": true
  },
  "editor.acceptSuggestionOnCommitCharacter": false,
  "editor.suggest.snippetsPreventQuickSuggestions": false,
  "files.associations": {
    "*.yml": "yaml",
    "*.yaml": "yaml"
  }
}
```

### Copilot Best Practices for This Project

#### 1. Working with GitHub Actions Workflows

**Use descriptive comments to guide Copilot**:

```yaml
# Good: Specific intent
# Fetch all starred repositories for the authenticated user using GraphQL API
# Handle pagination and rate limits gracefully

# Bad: Vague
# Get stars
```

**Example prompt for Copilot Chat**:

```
Create a GitHub Actions workflow that:
1. Fetches starred repositories using GraphQL
2. Handles pagination for up to 1000 repos
3. Retries on transient errors
4. Respects rate limits
5. Stores results in JSON format
```

#### 2. Editing the Manifest Schema

**Ask Copilot to explain first**:

```
# In Copilot Chat
@workspace /explain What does the repos-schema.json validate?
```

**Then request modifications**:

```
Add a new optional field to the repository schema for "personal_rating" (integer 1-5)
```

#### 3. Creating Classification Prompts

**Provide context in comments**:

```javascript
// AI Classification Prompt v2
// Goal: Accurately classify GitHub repositories into categories
// Available categories: dev-tools, ui-libraries, frameworks, databases, ...
// Output: JSON array with repo, categories, tags, framework

const systemPrompt = `
// Let Copilot generate the prompt here
```

#### 4. Generating README Templates

**Use inline chat**:

```markdown
<!-- Generate a README template for repository categories that includes:
- Category name and description
- List of repositories with metadata (stars, language, last updated)
- Links to related categories
- Statistics (total repos, top languages)
-->
```

## GitHub Copilot Chat Usage

### Essential Commands

Open Copilot Chat sidebar and use these agents:

- **@workspace** - Ask questions about the entire project
  ```
  @workspace How does the AI classification workflow work?
  ```

- **@terminal** - Get CLI commands
  ```
  @terminal How do I manually trigger the fetch-stars workflow?
  ```

- **/explain** - Explain code or configuration
  ```
  /explain #file:02-sync-stars.yml
  ```

- **/fix** - Fix issues in code
  ```
  /fix The workflow is failing on line 145
  ```

- **/tests** - Generate tests (if you add testing later)
  ```
  /tests Create tests for the sync workflow logic
  ```

### Example Conversations

#### Understanding the Project

```
You: @workspace What is the purpose of this repository?

Copilot: This repository is a GitHub Stars curation system that...
```

#### Making Changes

```
You: I want to add a new category "machine-learning" to the taxonomy

Copilot: To add a new category, you need to:
1. Update repos.yml under taxonomy.categories_allowed
2. Optionally update the AI classification prompt to recognize this category
3. Run validation to ensure schema compliance

Would you like me to help with any of these steps?
```

#### Debugging Workflows

```
You: The AI classification workflow failed with "Invalid JSON in classifications"

Copilot: This error typically occurs when the AI response includes markdown formatting.
Check the "Apply AI classification results" step and look for:
1. Backticks (```) in the response
2. "REJECTED:" prefix not being handled
3. Unexpected response format

Try adding this validation: [shows code]
```

## Advanced Copilot Features for This Project

### 1. Copilot Labs (Experimental)

If you have access to Copilot Labs:

- **Explain**: Get detailed explanations of complex workflows
- **Translate**: Convert between YAML and JSON
- **Brushes**: Refactor code for readability
- **Test Generation**: Create validation scripts

### 2. Custom Instructions

Configure project-specific context for better suggestions:

Create `.github/copilot-instructions.md`:

```markdown
# Project Context

This is a GitHub Actions-based automation system for managing starred repositories.

## Key Principles

- All automation must run in GitHub Actions (no external services)
- Use YAML for configuration (repos.yml is source of truth)
- Validate all data against JSON Schema
- Prefer AI classification over manual categorization
- Maintain backward compatibility with schema versions

## Common Patterns

- Workflows use github-script for JavaScript logic
- yq tool for YAML manipulation
- GitHub Models (GPT-4o) for AI inference
- cardinalby/schema-validator-action for validation

## Coding Standards

- Descriptive commit messages with emoji prefixes (🤖, 🌟, 📝)
- Inline comments for complex logic
- Error handling with GitHub issue creation
- Batch processing to respect rate limits
```

### 3. Workspace Indexing

Copilot indexes your workspace for better context:

- **Speed up indexing**: Keep `.gitignore` updated to exclude large files
- **Improve relevance**: Use consistent naming conventions
- **Enable file search**: Organize related files in clear directories

## Troubleshooting

### Copilot Not Suggesting

1. **Check authentication**
   ```
   VS Code: Click Copilot icon in status bar > Sign in
   ```

2. **Verify subscription**
   - Go to https://github.com/settings/copilot
   - Ensure subscription is active

3. **Restart IDE/Editor**

4. **Check file type**
   - Copilot works best with common languages
   - YAML support requires Red Hat YAML extension

### Suggestions Are Poor Quality

1. **Add more context**
   - Write descriptive comments
   - Use meaningful variable names
   - Provide examples in comments

2. **Use Copilot Chat**
   - Ask for explanations first
   - Request specific implementations
   - Iterate on suggestions

3. **Check network connection**
   - Copilot requires internet access
   - Corporate proxies may interfere

### Rate Limiting

If you hit Copilot rate limits:

1. **Wait a few minutes** (limits reset quickly)
2. **Use Chat instead of inline** (different quota)
3. **Write more manually** and request specific completions

## Best Practices Summary

### DO ✅

- ✅ Write descriptive comments before code blocks
- ✅ Use @workspace in Chat for project-wide questions
- ✅ Accept and modify suggestions (don't just accept blindly)
- ✅ Use Copilot Chat to understand before changing
- ✅ Provide examples in comments for complex patterns
- ✅ Review and test all AI-generated code

### DON'T ❌

- ❌ Accept suggestions without understanding them
- ❌ Commit secrets or sensitive data (Copilot may suggest placeholders)
- ❌ Rely solely on Copilot for critical security code
- ❌ Ignore linting and validation errors
- ❌ Over-rely on Copilot for learning (understand the patterns)

## Project-Specific Workflows with Copilot

### Adding a New Workflow

1. **Plan with Copilot Chat**:
   ```
   @workspace I want to create a workflow that generates README files
   for each category. What's the best approach?
   ```

2. **Create file**: `.github/workflows/04-generate-readmes.yml`

3. **Use comment-driven development**:
   ```yaml
   # Workflow: Generate README files for categories
   # Trigger: After AI classification completes
   # Steps:
   # 1. Checkout repository
   # 2. Parse repos.yml to extract categories
   # 3. For each category:
   #    - Create by-category/{category}/ directory
   #    - Generate README.md with repo list
   #    - Include metadata (stars, language, last updated)
   # 4. Commit and push changes
   ```

4. **Let Copilot generate** the workflow YAML

5. **Review, test, and iterate**

### Updating the Schema

1. **Understand current schema**:
   ```
   /explain #file:schemas/repos-schema.json
   ```

2. **Request modification**:
   ```
   Add a new optional field "priority" (enum: high, medium, low)
   to the repository schema
   ```

3. **Validate**:
   ```bash
   # Test with sample data
   yq eval 'repos.yml' | ajv validate -s schemas/repos-schema.json
   ```

### Writing Documentation

1. **Generate outline**:
   ```
   Create an outline for a user guide covering:
   - Setup
   - Daily usage
   - Troubleshooting
   - Advanced customization
   ```

2. **Fill sections**:
   ```markdown
   ## Setup

   <!-- Copilot will suggest content based on existing docs -->
   ```

3. **Improve with examples**:
   ```
   Add a practical example of classifying a new repository
   ```

## Additional Resources

### Official Documentation

- [GitHub Copilot Docs](https://docs.github.com/en/copilot)
- [Copilot in VS Code](https://code.visualstudio.com/docs/editor/github-copilot)
- [Copilot Best Practices](https://github.blog/2023-06-20-how-to-write-better-prompts-for-github-copilot/)

### Learning Resources

- [GitHub Skills - Copilot](https://skills.github.com/)
- [Copilot Examples](https://github.com/github/copilot-preview)
- [Awesome Copilot](https://github.com/awesome-copilot/awesome-copilot)

### Community

- [GitHub Copilot Discussions](https://github.com/orgs/community/discussions/categories/copilot)
- [VS Code Copilot Issues](https://github.com/microsoft/vscode-copilot-release/issues)

## Next Steps

1. **Install GitHub Copilot** following the steps above
2. **Open this project** in your preferred IDE
3. **Try the example prompts** in Copilot Chat
4. **Start with documentation** (easy way to learn Copilot)
5. **Gradually use for code** (workflows, scripts, schemas)

## Feedback and Improvements

If you find Copilot particularly helpful (or unhelpful) for certain tasks in this project, please:

1. **Document it**: Add to this guide
2. **Share examples**: Create examples/ directory with prompts and results
3. **Improve prompts**: Update comments to generate better suggestions

---

**Last Updated**: 2025-10-19  
**Status**: Complete setup guide  
**Copilot Version**: Latest (as of writing)
