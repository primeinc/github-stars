#!/usr/bin/env node

/**
 * Fetch starred repositories using GitHub GraphQL API
 * Much more efficient than REST - gets all data in one query type
 */

const { execSync } = require('child_process');
const fs = require('fs');

// Read query from file to avoid shell escaping issues
const queryPath = require('path').join(__dirname, '..', 'queries', 'stars-query.graphql');
const STARS_QUERY = fs.readFileSync(queryPath, 'utf8');

// Helper function for delays
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchAllStarsGraphQL(resumeFromCheckpoint = false) {
  console.log('Fetching starred repositories via GraphQL...');
  
  let hasNextPage = true;
  let cursor = null;
  let allRepos = [];
  let pageCount = 0;
  let retryCount = 0;
  const maxRetries = 5;
  const checkpointFile = 'fetch-checkpoint.json';
  
  // Try to resume from checkpoint if requested
  if (resumeFromCheckpoint && fs.existsSync(checkpointFile)) {
    try {
      const checkpoint = JSON.parse(fs.readFileSync(checkpointFile, 'utf8'));
      allRepos = checkpoint.repos || [];
      cursor = checkpoint.cursor;
      pageCount = checkpoint.pageCount || 0;
      console.log(`Resuming from page ${pageCount + 1} with ${allRepos.length} repos already fetched...`);
    } catch (e) {
      console.log('Failed to read checkpoint, starting fresh...');
    }
  }
  
  while (hasNextPage) {
    pageCount++;
    console.log(`Fetching page ${pageCount}...`);
    
    const variables = cursor ? { cursor } : {};
    
    try {
      // Build the full query with variables
      const fullQuery = JSON.stringify({
        query: STARS_QUERY,
        variables: cursor ? { cursor } : {}
      });
      
      const result = execSync(
        `gh api graphql --input -`,
        { 
          encoding: 'utf8', 
          maxBuffer: 10 * 1024 * 1024,
          input: fullQuery
        }
      );
      
      const data = JSON.parse(result);
      const repos = data.data.viewer.starredRepositories;
      
      // Reset retry count on success
      retryCount = 0;
      
      // Process this page
      const pageRepos = repos.edges.map(edge => ({
        repo: edge.node.nameWithOwner,
        description: edge.node.description || '',
        language: edge.node.primaryLanguage?.name || null,
        topics: edge.node.repositoryTopics.nodes.map(n => n.topic.name),
        archived: edge.node.isArchived,
        fork: edge.node.isFork,
        private: edge.node.isPrivate,
        stargazers_count: edge.node.stargazerCount,
        updated_at: edge.node.updatedAt,
        html_url: edge.node.url,
        default_branch: edge.node.defaultBranchRef?.name || 'main',
        last_commit_sha: edge.node.defaultBranchRef?.target?.oid || null,
        starred_at: edge.starredAt,
        // Extra metadata we can use
        homepage_url: edge.node.homepageUrl,
        is_mirror: edge.node.isMirror,
        mirror_url: edge.node.mirrorUrl,
        license: edge.node.licenseInfo?.spdxId || null,
        latest_release: edge.node.latestRelease ? {
          tag: edge.node.latestRelease.tagName,
          published_at: edge.node.latestRelease.publishedAt
        } : null
      }));
      
      // Filter out private repos
      const publicRepos = pageRepos.filter(r => !r.private);
      allRepos = allRepos.concat(publicRepos);
      
      // Check if we need to continue
      hasNextPage = repos.pageInfo.hasNextPage;
      cursor = repos.pageInfo.endCursor;
      
      console.log(`  Found ${publicRepos.length} public repos (total so far: ${allRepos.length})`);
      
      // Save checkpoint after each successful page
      if (hasNextPage && allRepos.length > 0) {
        fs.writeFileSync(checkpointFile, JSON.stringify({
          repos: allRepos,
          cursor: cursor,
          pageCount: pageCount,
          timestamp: new Date().toISOString()
        }, null, 2));
      }
      
      // Small delay between requests to avoid rate limits (500ms)
      if (hasNextPage) {
        await sleep(500);
      }
      
    } catch (error) {
      // Check if it's a rate limit error
      if (error.message.includes('secondary rate limit') || error.message.includes('API rate limit')) {
        retryCount++;
        if (retryCount > maxRetries) {
          console.error('Max retries exceeded. Saving partial results...');
          return allRepos;
        }
        
        // Exponential backoff: 2^retryCount seconds, max 5 minutes
        const waitTime = Math.min(Math.pow(2, retryCount), 300);
        console.log(`Rate limit hit. Waiting ${waitTime} seconds before retry ${retryCount}/${maxRetries}...`);
        
        await sleep(waitTime * 1000);
        
        // Retry the same page
        pageCount--;
        continue;
      }
      
      // Other errors
      console.error('GraphQL query failed:', error.message);
      if (allRepos.length > 0) {
        console.log('Saving partial results...');
        return allRepos;
      }
      process.exit(1);
    }
  }
  
  console.log(`\nTotal starred repositories found: ${allRepos.length}`);
  
  // Clean up checkpoint file on successful completion
  if (fs.existsSync(checkpointFile)) {
    fs.unlinkSync(checkpointFile);
  }
  
  return allRepos;
}

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const resume = args.includes('--resume');
  
  fetchAllStarsGraphQL(resume).then(repos => {
    fs.writeFileSync('fetched-stars-graphql.json', JSON.stringify(repos, null, 2));
    console.log('Saved to fetched-stars-graphql.json');
    
    // Summary stats
    const archived = repos.filter(r => r.archived).length;
    const forks = repos.filter(r => r.fork).length;
    const noDesc = repos.filter(r => !r.description).length;
    
    console.log(`\nSummary:`);
    console.log(`  Archived: ${archived}`);
    console.log(`  Forks: ${forks}`);
    console.log(`  No description: ${noDesc}`);
  }).catch(error => {
    console.error('Fatal error:', error);
    console.log('\nTo resume from last checkpoint, run: node fetch-stars-graphql.js --resume');
    process.exit(1);
  });
}

module.exports = { fetchAllStarsGraphQL };