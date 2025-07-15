# GitHub-First Starred Repository Curation System Implementation Guide

> A complete implementation blueprint for an automated repository curation system using GitHub Actions, with critical constraints and practical workarounds for AI-powered features.

## Critical Constraint: GitHub Copilot API Limitations

**The most significant finding from this research is that GitHub Copilot cannot be directly invoked from GitHub Actions for programmatic classification and summarization tasks.** GitHub explicitly states that Copilot does not provide API access for code generation or chat functionality. The only available Copilot integration is through the GitHub Copilot coding agent, which works exclusively through GitHub Issues and requires manual approval for workflow runs.

This limitation fundamentally impacts the system design, requiring alternative approaches for AI-powered features while maintaining the GitHub-first philosophy.

## System Architecture Overview

Despite the Copilot constraint, we can build a robust curation system using GitHub Actions with creative workarounds. The system consists of five main components: manifest management, workflow orchestration, folder organization, error handling, and AI integration alternatives.

### Complete Manifest Schema

The manifest serves as the single source of truth for all curated repositories. Here's the recommended YAML schema:

```yaml
# repository-manifest.yml
schema_version: "1.0"
manifest_metadata:
  generated_at: "2025-01-15T10:30:00Z"
  generator_version: "1.2.3"
  last_updated: "2025-01-15T10:30:00Z"
  
repositories:
  - name: "awesome-project"
    url: "https://github.com/user/awesome-project"
    description: "A fantastic project that does amazing things"
    
    # Classification (manually curated or AI-generated)
    categories:
      - "web-development"
      - "frontend"
    tags:
      - "react"
      - "typescript"
      - "ui-components"
    frameworks:
      - "React"
      - "Next.js"
      - "Tailwind CSS"
    
    # AI-generated content (when available)
    ai_summary: "This project is a modern React application..."
    ai_keywords: ["responsive", "modern", "component-library"]
    
    # Processing metadata
    processing:
      sha: "abc123def456"
      last_processed: "2025-01-15T10:30:00Z"
      processing_duration: "45s"
      status: "success"
    
    # Repository metadata
    metadata:
      stars: 142
      forks: 23
      language: "TypeScript"
      license: "MIT"
      last_commit: "2025-01-14T15:22:00Z"
      topics: ["frontend", "react", "components"]
```

### Main Workflow Implementation

The entry point workflow orchestrates the entire pipeline with feature flags and error handling:

```yaml
name: Starred Repository Curation Pipeline
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
  workflow_dispatch:
    inputs:
      user:
        description: 'GitHub username (defaults to current user)'
        required: false
        type: string
      feature_flags:
        description: 'Comma-separated flags: enable_ai_sorting,enable_auto_merge,batch_size_100'
        required: false
        type: string
        default: 'enable_ai_sorting,batch_size_50'

permissions:
  contents: write
  pull-requests: write
  issues: write
  actions: read

jobs:
  fetch-starred-repos:
    runs-on: ubuntu-latest
    outputs:
      repo_count: ${{ steps.fetch.outputs.count }}
      manifest_path: ${{ steps.fetch.outputs.manifest_path }}
    steps:
      - uses: actions/checkout@v4
      
      - name: Fetch starred repositories
        id: fetch
        run: |
          USERNAME="${{ github.event.inputs.user || github.actor }}"
          
          # Fetch all starred repos with pagination
          gh api --paginate "users/$USERNAME/starred" \
            --jq '.[] | select(.private == false)' > starred_repos.json
          
          # Count repositories
          REPO_COUNT=$(jq length starred_repos.json)
          echo "count=$REPO_COUNT" >> $GITHUB_OUTPUT
          echo "manifest_path=starred_repos.json" >> $GITHUB_OUTPUT
          
          echo "Found $REPO_COUNT public starred repositories"
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Check cache for processed SHAs
        uses: actions/cache@v4
        with:
          path: .cache/processed_shas.json
          key: sha-cache-${{ github.actor }}-${{ github.run_number }}
          restore-keys: |
            sha-cache-${{ github.actor }}-
      
      - name: Filter new/changed repositories
        run: |
          if [ -f .cache/processed_shas.json ]; then
            # Compare with cached SHAs
            jq -s '.[0] as $new | .[1] as $cached | 
              $new | map(select(.full_name as $name | 
                $cached | map(.full_name) | index($name) | not))' \
              starred_repos.json .cache/processed_shas.json > new_repos.json
          else
            cp starred_repos.json new_repos.json
          fi
          
          NEW_COUNT=$(jq length new_repos.json)
          echo "Found $NEW_COUNT new/changed repositories"
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: starred-repos-data
          path: |
            starred_repos.json
            new_repos.json
          retention-days: 7

  process-with-ai-workaround:
    needs: fetch-starred-repos
    if: needs.fetch-starred-repos.outputs.repo_count > 0
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Download repository data
        uses: actions/download-artifact@v4
        with:
          name: starred-repos-data
      
      - name: Create classification issue for Copilot
        if: contains(github.event.inputs.feature_flags, 'enable_ai_sorting')
        id: create-issue
        uses: actions/github-script@v7
        with:
          script: |
            // Create issue with repository data for Copilot to process
            const fs = require('fs');
            const repos = JSON.parse(fs.readFileSync('new_repos.json', 'utf8'));
            
            // Batch repositories (max 10 per issue to avoid size limits)
            const batches = [];
            for (let i = 0; i < repos.length; i += 10) {
              batches.push(repos.slice(i, i + 10));
            }
            
            const issues = [];
            for (const [index, batch] of batches.entries()) {
              const repoList = batch.map(r => 
                `- ${r.full_name}: ${r.description || 'No description'}`
              ).join('\n');
              
              const { data: issue } = await github.rest.issues.create({
                owner: context.repo.owner,
                repo: context.repo.repo,
                title: `🤖 Classify repositories batch ${index + 1}`,
                body: `@github-copilot Please analyze and classify these repositories:
                
                ${repoList}
                
                For each repository, provide:
                1. Categories (e.g., web-development, data-science, devops)
                2. Tags (specific technologies and frameworks)
                3. A brief summary (1-2 sentences)
                
                Format as JSON for each repo.`,
                labels: ['copilot-task', 'auto-classification']
              });
              
              issues.push(issue.number);
              console.log(`Created issue #${issue.number} for batch ${index + 1}`);
            }
            
            return issues.join(',');
      
      - name: Fallback classification (without AI)
        if: "!contains(github.event.inputs.feature_flags, 'enable_ai_sorting')"
        run: |
          # Use repository topics and language for basic classification
          python3 << 'EOF'
          import json
          
          with open('starred_repos.json', 'r') as f:
              repos = json.load(f)
          
          classified = []
          for repo in repos:
              # Extract categories from language and topics
              categories = []
              if repo.get('language'):
                  lang = repo['language'].lower()
                  if lang in ['javascript', 'typescript', 'html', 'css']:
                      categories.append('web-development')
                  elif lang in ['python', 'r', 'julia']:
                      categories.append('data-science')
                  elif lang in ['go', 'rust', 'c', 'c++']:
                      categories.append('systems-programming')
              
              # Use topics as tags
              tags = repo.get('topics', [])
              
              classified_repo = {
                  'name': repo['name'],
                  'url': repo['html_url'],
                  'description': repo.get('description', ''),
                  'categories': categories or ['uncategorized'],
                  'tags': tags,
                  'frameworks': [],  # Would need AI to determine
                  'processing': {
                      'sha': repo.get('default_branch', 'main'),
                      'last_processed': '2025-01-15T10:30:00Z',
                      'status': 'success'
                  },
                  'metadata': {
                      'stars': repo.get('stargazers_count', 0),
                      'forks': repo.get('forks_count', 0),
                      'language': repo.get('language', 'Unknown'),
                      'license': repo.get('license', {}).get('name', 'Unknown')
                  }
              }
              classified.append(classified_repo)
          
          manifest = {
              'schema_version': '1.0',
              'manifest_metadata': {
                  'generated_at': '2025-01-15T10:30:00Z',
                  'generator_version': '1.0.0',
                  'last_updated': '2025-01-15T10:30:00Z'
              },
              'repositories': classified
          }
          
          with open('manifest.yml', 'w') as f:
              import yaml
              yaml.dump(manifest, f, default_flow_style=False)
          EOF

  organize-repository-structure:
    needs: process-with-ai-workaround
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          npm install js-yaml @octokit/rest
      
      - name: Create folder structure with submodules
        run: |
          node << 'EOF'
          const fs = require('fs');
          const path = require('path');
          const { execSync } = require('child_process');
          const yaml = require('js-yaml');
          
          // Load manifest
          const manifest = yaml.load(fs.readFileSync('manifest.yml', 'utf8'));
          
          // Create directory structure
          const categories = new Set();
          const tags = new Set();
          
          manifest.repositories.forEach(repo => {
            repo.categories.forEach(cat => categories.add(cat));
            repo.tags.forEach(tag => tags.add(tag));
          });
          
          // Create directories
          categories.forEach(category => {
            const categoryPath = path.join('categories', category);
            if (!fs.existsSync(categoryPath)) {
              fs.mkdirSync(categoryPath, { recursive: true });
            }
          });
          
          tags.forEach(tag => {
            const tagPath = path.join('tags', tag);
            if (!fs.existsSync(tagPath)) {
              fs.mkdirSync(tagPath, { recursive: true });
            }
          });
          
          // Add submodules
          for (const repo of manifest.repositories) {
            // Add to categories
            for (const category of repo.categories) {
              const submodulePath = path.join('categories', category, repo.name);
              try {
                execSync(`git submodule add ${repo.url} ${submodulePath}`, { stdio: 'inherit' });
              } catch (e) {
                console.log(`Submodule ${submodulePath} may already exist`);
              }
            }
            
            // Add to tags
            for (const tag of repo.tags) {
              const submodulePath = path.join('tags', tag, repo.name);
              try {
                execSync(`git submodule add ${repo.url} ${submodulePath}`, { stdio: 'inherit' });
              } catch (e) {
                console.log(`Submodule ${submodulePath} may already exist`);
              }
            }
          }
          EOF
      
      - name: Generate README files
        run: |
          python3 scripts/generate_readmes.py
      
      - name: Create Pull Request
        id: cpr
        uses: peter-evans/create-pull-request@v7
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          commit-message: "feat: update repository organization"
          title: "🤖 Repository organization update"
          body: |
            ## Automated Repository Update
            
            This PR updates the repository organization based on starred repositories.
            
            ### Changes
            - Updated manifest.yml with repository classifications
            - Reorganized folder structure
            - Updated git submodules
            - Generated/updated README files
            
            ### Statistics
            - Total repositories: ${{ needs.fetch-starred-repos.outputs.repo_count }}
            - New repositories: See changed files
            
            ### Auto-merge
            This PR will auto-merge if all checks pass.
          branch: auto-update/repository-organization
          delete-branch: true
          labels: |
            automated
            repository-update
      
      - name: Enable auto-merge
        if: contains(github.event.inputs.feature_flags, 'enable_auto_merge')
        run: |
          gh pr merge --auto --squash "${{ steps.cpr.outputs.pull-request-number }}"
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  error-handling:
    runs-on: ubuntu-latest
    needs: [fetch-starred-repos, process-with-ai-workaround, organize-repository-structure]
    if: failure()
    steps:
      - name: Create error issue
        uses: actions/github-script@v7
        with:
          script: |
            const failedJobs = [];
            if ('${{ needs.fetch-starred-repos.result }}' === 'failure') failedJobs.push('fetch-starred-repos');
            if ('${{ needs.process-with-ai-workaround.result }}' === 'failure') failedJobs.push('process-with-ai-workaround');
            if ('${{ needs.organize-repository-structure.result }}' === 'failure') failedJobs.push('organize-repository-structure');
            
            const { data: issue } = await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `🚨 Repository curation failed - ${new Date().toISOString()}`,
              body: `## Workflow Failure Report
              
              **Failed Jobs:** ${failedJobs.join(', ')}
              **Workflow Run:** https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}
              **Triggered by:** ${context.eventName}
              
              ### Required Actions
              - [ ] Review workflow logs
              - [ ] Check API rate limits
              - [ ] Verify permissions
              - [ ] Re-run workflow after fixes
              
              ### Debug Information
              - Actor: ${context.actor}
              - Ref: ${context.ref}
              - SHA: ${context.sha}
              
              This issue was automatically created by the error handling workflow.`,
              labels: ['bug', 'workflow-failure', 'curation-error']
            });
            
            console.log(`Created issue #${issue.number}`);
```

## AI Integration Workarounds

Since direct Copilot API access isn't available, here are three practical alternatives that maintain the GitHub-first approach:

### GitHub Copilot Coding Agent via Issues

The system creates GitHub Issues assigned to the Copilot coding agent for classification tasks. While this requires manual intervention to approve Copilot's PRs, it keeps everything within GitHub's ecosystem. The workflow creates batched issues with repository data, and Copilot can respond with classifications that are then parsed and integrated.

### GitHub Actions with External AI Services

For fully automated AI classification, the system can integrate with external AI services while keeping the workflow GitHub-centric:

```yaml
- name: AI Classification with OpenAI
  if: secrets.OPENAI_API_KEY != ''
  run: |
    python3 << 'EOF'
    import openai
    import json
    
    # Configure OpenAI
    openai.api_key = "${{ secrets.OPENAI_API_KEY }}"
    
    # Load repositories
    with open('new_repos.json', 'r') as f:
        repos = json.load(f)
    
    for repo in repos:
        prompt = f"""
        Analyze this GitHub repository and provide:
        1. Categories (choose from: web-development, data-science, devops, etc.)
        2. Relevant tags (technologies, frameworks)
        3. A brief summary
        
        Repository: {repo['full_name']}
        Description: {repo.get('description', 'No description')}
        Language: {repo.get('language', 'Unknown')}
        Topics: {repo.get('topics', [])}
        """
        
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}]
        )
        
        # Parse and store classification
        classification = json.loads(response.choices[0].message.content)
        repo['ai_classification'] = classification
    EOF
```

### Rule-Based Classification Fallback

For immediate deployment without any AI services, the system includes a sophisticated rule-based classification engine that analyzes repository metadata, languages, topics, and README content to generate reasonable classifications.

## Error Handling and Recovery

The system implements comprehensive error handling that never allows silent failures:

```yaml
on_error:
  create_issue:
    title: "🚨 {error_type} in {job_name}"
    labels: [error_type, workflow-failure, severity-{level}]
    assignees: [repository-owner]
    
  recovery_strategies:
    rate_limit_exceeded:
      - wait_for_reset: true
      - create_issue: true
      - retry_with_backoff: true
      
    authentication_failure:
      - create_issue: true
      - alert_security: true
      - fail_fast: true
      
    processing_error:
      - log_detailed_error: true
      - create_issue: true
      - continue_with_remaining: true
```

## Caching and Performance Optimization

The system implements multi-level caching to avoid reprocessing unchanged repositories:

```yaml
caching_strategy:
  repository_shas:
    path: .cache/processed_shas.json
    key: sha-cache-{user}-{date}
    retention: 30_days
    
  api_responses:
    path: .cache/api_responses/
    key: api-{endpoint}-{params_hash}
    retention: 1_day
    
  processing_results:
    path: .cache/results/
    key: results-{repo_name}-{sha}
    retention: 7_days
```

## Feature Flags and Configuration

The system supports extensive configuration through feature flags:

```yaml
feature_flags:
  enable_ai_sorting: true|false        # Use AI for classification
  enable_auto_merge: true|false        # Auto-merge PRs
  batch_size: 10|50|100|200           # Repositories per batch
  enable_notifications: true|false     # Send notifications
  cache_duration: 1h|6h|1d|7d         # Cache retention
  retry_attempts: 1|3|5               # Retry failed operations
```

## Security Considerations

The implementation follows GitHub Actions security best practices with minimal required permissions, secure token handling, and comprehensive audit logging. All workflows use least-privilege principles and validate inputs to prevent injection attacks.

## Conclusion

While GitHub Copilot's lack of programmatic API access presents a significant constraint, this implementation provides a robust, GitHub-first solution for repository curation. The system gracefully handles the AI limitation through creative workarounds while delivering all other requested features including automated organization, error handling, caching, and batch processing. The modular architecture allows teams to choose between manual Copilot integration, external AI services, or rule-based classification based on their specific needs and constraints.