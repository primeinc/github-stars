#!/usr/bin/env node
/**
 * One-shot recovery script.
 *
 * Pulls every starred repository for the authenticated user via the REST
 * `/user/starred` endpoint (Link-paginated, 100 per page). Transforms each
 * entry into the same field shape that `02-sync-stars.yml` expects (matching
 * the GraphQL output schema in `01-fetch-stars.yml` L80-106). Writes
 * `.github-stars/data/fetched-stars-graphql.json` for use as a one-time
 * canonical handoff.
 *
 * NOT a workflow change. Runs locally, requires gh CLI auth or GH_TOKEN env.
 *
 * Why REST: the GraphQL viewer.starredRepositories query exceeds GitHub's
 * documented 10s per-request server-side timeout for an account with 2,600+
 * stars × 15 fields/repo × repositoryTopics(first:20). Direct evidence:
 * runs 25619285899 (page 1 took 9.4s, page 3 502'd 6 times),
 * 25619534107 (failure on page 3), 25620744201 (cancelled mid retry storm).
 * REST `/user/starred` returns each star in a single resource fetch and
 * uses Link header pagination; per-page work is bounded by the per-resource
 * timeout, not a query-cost budget.
 *
 * License field: REST returns `license: { spdx_id }` (snake_case) vs
 * GraphQL's `licenseInfo.spdxId`. We normalize.
 *
 * latest_release: REST does NOT include this in /user/starred. We leave
 * `latest_release: null`. Acceptable because:
 *   - the schema treats it as optional (verified: schemas/repos-schema.json)
 *   - the field is not used by 02-sync's reconciliation logic
 *   - downstream consumers can re-fetch per-repo if needed
 *
 * defaultBranchRef.target.oid: REST does NOT include the commit SHA in
 * /user/starred. We set `last_commit_sha: '0'.repeat(40)` (sentinel, also
 * what 02-sync uses for new repos at L211). 02-sync's `Sync metadata for
 * existing repos` block (L246+) only updates last_commit_sha when fresh
 * value differs and is truthy — sentinel won't overwrite a real prior SHA.
 */

import https from 'node:https';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { execSync } from 'node:child_process';

const OUTPUT_FILE = '.github-stars/data/fetched-stars-graphql.json';
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || (() => {
  try {
    return execSync('gh auth token', { encoding: 'utf8' }).trim();
  } catch (e) {
    console.error('No token. Set GH_TOKEN or run `gh auth login`.');
    process.exit(1);
  }
})();

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      method: 'GET',
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/vnd.github.star+json',
        'User-Agent': 'primeinc-recovery-script',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} from ${url}: ${body.substring(0, 500)}`));
        }
        try {
          const data = JSON.parse(body);
          resolve({ data, headers: res.headers, status: res.statusCode });
        } catch (e) {
          reject(new Error(`JSON parse failed for ${url}: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function parseLink(linkHeader) {
  if (!linkHeader) return {};
  const links = {};
  for (const part of linkHeader.split(',')) {
    const m = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (m) links[m[2]] = m[1];
  }
  return links;
}

function transform(item) {
  // item is { starred_at, repo: { ... } } per Accept: application/vnd.github.star+json
  const r = item.repo;
  return {
    repo: r.full_name,
    description: r.description || '',
    language: r.language || null,
    topics: r.topics || [],
    archived: !!r.archived,
    fork: !!r.fork,
    private: !!r.private,
    stargazers_count: r.stargazers_count || 0,
    forks_count: r.forks_count || 0,
    updated_at: r.updated_at || null,
    pushed_at: r.pushed_at || null,
    disk_usage: r.size || null,                  // REST: `size` in KB; GraphQL: `diskUsage` in KB. Same units.
    owner_avatar: r.owner?.avatar_url || null,
    html_url: r.html_url || null,
    default_branch: r.default_branch || 'main',
    last_commit_sha: '0'.repeat(40),             // REST does not include this; 02-sync uses sentinel for new repos
    user_starred_at: item.starred_at,
    homepage_url: r.homepage || null,
    is_mirror: !!r.mirror_url,                   // REST does not have isMirror; mirror_url presence is the proxy
    mirror_url: r.mirror_url || null,
    license: r.license?.spdx_id || null,
    latest_release: null,                        // REST /user/starred does not include releases
  };
}

async function main() {
  let url = 'https://api.github.com/user/starred?per_page=100&page=1';
  let allRepos = [];
  let pageCount = 0;
  let lastPageUrl = null;
  let lastPageNum = null;

  console.log(`Fetching all starred repos via REST...`);

  while (url) {
    pageCount++;
    const t0 = Date.now();
    const { data, headers } = await fetchPage(url);
    const elapsed = Date.now() - t0;

    if (!Array.isArray(data)) {
      throw new Error(`Page ${pageCount} did not return an array (got ${typeof data})`);
    }

    const transformed = data.map(transform);
    const publicOnly = transformed.filter(r => !r.private);
    allRepos = allRepos.concat(publicOnly);

    const links = parseLink(headers.link);
    if (!lastPageUrl && links.last) {
      lastPageUrl = links.last;
      const m = lastPageUrl.match(/[?&]page=(\d+)/);
      lastPageNum = m ? parseInt(m[1], 10) : null;
    }

    const remaining = headers['x-ratelimit-remaining'];
    console.log(`  page ${pageCount}${lastPageNum ? '/' + lastPageNum : ''}: ${data.length} items, ${publicOnly.length} public, total=${allRepos.length}, ${elapsed}ms, rate-remaining=${remaining}`);

    url = links.next || null;
  }

  console.log(`\nTotal: ${allRepos.length} public starred repos across ${pageCount} pages`);

  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(allRepos, null, 2));
  const bytes = Buffer.byteLength(JSON.stringify(allRepos, null, 2));
  console.log(`Wrote ${OUTPUT_FILE} (${bytes} bytes)`);
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  console.error(e.stack);
  process.exit(1);
});
