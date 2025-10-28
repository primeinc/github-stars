# GitHub Copilot Setup Guide

This document outlines setup steps for GitHub Copilot when contributing to the github-stars project.

## Prerequisites

### 1. GitHub Copilot Subscription

Required subscription:
- Individual Plan: $10/month or $100/year
- Business Plan: $19/user/month
- Enterprise Plan: Contact GitHub sales

Get started: https://github.com/features/copilot

**For Students:** Free via GitHub Global Campus for verified students  
**For Open Source:** Some programs offer free access for maintainers

### 2. Supported IDE

GitHub Copilot is available for:
- Visual Studio Code (recommended for this project)
- Visual Studio
- JetBrains IDEs (IntelliJ, PyCharm, WebStorm)
- Neovim
- Vim

**Recommendation:** Use VS Code for best integration with GitHub Actions and YAML files.

### 3. Git and GitHub CLI

Ensure you have:
- Git installed and configured
- GitHub account with repository access
- GitHub CLI (gh) for advanced features (optional)

## Installation

### VS Code Setup (Recommended)

1. **Install VS Code** from https://code.visualstudio.com/

2. **Install GitHub Copilot Extension**
   - Open Extensions (Ctrl+Shift+X or Cmd+Shift+X)
   - Search for "GitHub Copilot"
   - Click Install
   - Or visit: https://marketplace.visualstudio.com/items?itemName=GitHub.copilot

3. **Install Recommended Extensions**
   - GitHub Copilot Chat (companion to Copilot)
   - YAML (Red Hat) - for workflow editing
   - GitHub Actions (GitHub) - workflow intellisense
   - JSON Schema (Red Hat) - schema validation
   - Markdown All in One - documentation editing

4. **Authenticate GitHub Copilot**
   - Open VS Code
   - Sign in to GitHub when prompted
   - Authorize Copilot access

5. **Verify Installation**
   - Open any file (e.g., .github/workflows/01-fetch-stars.yml)
   - Start typing a comment - Copilot should suggest code
   - Check status bar for Copilot icon (should be active)

### JetBrains IDEs Setup

1. Open IDE (IntelliJ IDEA, PyCharm, WebStorm, etc.)
2. Go to Settings/Preferences > Plugins > Marketplace
3. Search for "GitHub Copilot" and install
4. Restart IDE
5. Sign in: Tools > GitHub Copilot > Sign in to GitHub
6. Verify: Open any code file and start typing

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

3. **Verify:** Open any file, start typing in insert mode, press Tab to accept suggestions

## Project Configuration

### VS Code Workspace Settings

Create `.vscode/settings.json` in the project root:

```json
{
  "github.copilot.enable": {
    "*": true,
    "yaml": true,
    "markdown": true,
    "json": true,
    "javascript": true
  },
  "yaml.schemas": {
    "./schemas/repos-schema.json": "repos.yml"
  },
  "editor.quickSuggestions": {
    "other": true,
    "comments": true,
    "strings": true
  },
  "files.associations": {
    "*.yml": "yaml",
    "*.yaml": "yaml"
  }
}
```

### Best Practices for This Project

**Working with GitHub Actions Workflows:**

Use descriptive comments to guide Copilot:

```yaml
# Good: Specific intent
# Fetch all starred repositories for the authenticated user using GraphQL API
# Handle pagination and rate limits gracefully

# Bad: Vague
# Get stars
```

**Example Copilot Chat prompts:**

```
Create a GitHub Actions workflow that:
1. Fetches starred repositories using GraphQL
2. Handles pagination for up to 1000 repos
3. Retries on transient errors
4. Respects rate limits
5. Stores results in JSON format
```

**Editing the Manifest Schema:**

Ask Copilot to explain first:
```
@workspace /explain What does the repos-schema.json validate?
```

Then request modifications:
```
Add a new optional field to the repository schema for "personal_rating" (integer 1-5)
```

**Creating Classification Prompts:**

Provide context in comments:
```javascript
// AI Classification Prompt v2
// Goal: Accurately classify GitHub repositories into categories
// Available categories: dev-tools, ui-libraries, frameworks, databases, ...
// Output: JSON array with repo, categories, tags, framework

const systemPrompt = `
// Let Copilot generate the prompt here
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

### Example Conversations

**Understanding the Project:**
```
You: @workspace What is the purpose of this repository?

Copilot: This repository is a GitHub Stars curation system that...
```

**Making Changes:**
```
You: I want to add a new category "machine-learning" to the taxonomy

Copilot: To add a new category, you need to:
1. Update repos.yml under taxonomy.categories_allowed
2. Optionally update the AI classification prompt
3. Run validation to ensure schema compliance
```

**Debugging Workflows:**
```
You: The AI classification workflow failed with "Invalid JSON in classifications"

Copilot: This error typically occurs when the AI response includes markdown formatting.
Check the "Apply AI classification results" step and look for...
```

## Troubleshooting

### Copilot Not Suggesting

1. **Check authentication:** Click Copilot icon in status bar > Sign in
2. **Verify subscription:** Go to https://github.com/settings/copilot
3. **Restart IDE**
4. **Check file type:** Copilot works best with common languages. YAML support requires Red Hat YAML extension

### Suggestions Are Poor Quality

1. **Add more context:** Write descriptive comments, use meaningful variable names
2. **Use Copilot Chat:** Ask for explanations first, request specific implementations
3. **Check network connection:** Copilot requires internet access

### Rate Limiting

If you hit Copilot rate limits:
1. Wait a few minutes (limits reset quickly)
2. Use Chat instead of inline (different quota)
3. Write more manually and request specific completions

## Best Practices Summary

**Do:**
- Write descriptive comments before code blocks
- Use @workspace in Chat for project-wide questions
- Accept and modify suggestions (don't accept blindly)
- Use Copilot Chat to understand before changing
- Provide examples in comments for complex patterns
- Review and test all AI-generated code

**Don't:**
- Accept suggestions without understanding them
- Commit secrets or sensitive data
- Rely solely on Copilot for critical security code
- Ignore linting and validation errors
- Over-rely on Copilot for learning

## Project-Specific Workflows

### Adding a New Workflow

1. Plan with Copilot Chat:
   ```
   @workspace I want to create a workflow that generates README files
   for each category. What's the best approach?
   ```

2. Create file: `.github/workflows/04-generate-readmes.yml`

3. Use comment-driven development:
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

4. Let Copilot generate the workflow YAML
5. Review, test, and iterate

### Updating the Schema

1. Understand current schema: `/explain #file:schemas/repos-schema.json`
2. Request modification: `Add a new optional field "priority" (enum: high, medium, low) to the repository schema`
3. Validate with sample data

### Writing Documentation

1. Generate outline:
   ```
   Create an outline for a user guide covering:
   - Setup
   - Daily usage
   - Troubleshooting
   - Advanced customization
   ```

2. Fill sections with Copilot's help
3. Improve with examples

## Additional Resources

**Official Documentation:**
- [GitHub Copilot Docs](https://docs.github.com/en/copilot)
- [Copilot in VS Code](https://code.visualstudio.com/docs/editor/github-copilot)
- [Copilot Best Practices](https://github.blog/2023-06-20-how-to-write-better-prompts-for-github-copilot/)

**Learning Resources:**
- [GitHub Skills - Copilot](https://skills.github.com/)
- [Awesome Copilot](https://github.com/awesome-copilot/awesome-copilot)

**Community:**
- [GitHub Copilot Discussions](https://github.com/orgs/community/discussions/categories/copilot)
- [VS Code Copilot Issues](https://github.com/microsoft/vscode-copilot-release/issues)

## Next Steps

1. Install GitHub Copilot following the steps above
2. Open this project in your preferred IDE
3. Try the example prompts in Copilot Chat
4. Start with documentation (easy way to learn Copilot)
5. Gradually use for code (workflows, scripts, schemas)

---

**Last Updated:** 2025-10-19  
**Status:** Complete setup guide  
**Copilot Version:** Latest
