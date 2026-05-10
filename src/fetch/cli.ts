// CLI: invoked by .github/workflows/01-fetch-stars.yml as the single
// fetch step. Replaces the prior actions/github-script JS blob.
//
// Reads env (no positional args):
//   GH_TOKEN              token for star-fetch (required)
//   RESUME_CURSOR         optional resume cursor (workflow_dispatch input)
//   LIST_QUERY_PATH       default queries/stars-list-query.graphql
//   METADATA_FRAGMENT_PATH default queries/stars-metadata-fragment.graphql
//   OUTPUT_FILE           default .github-stars/data/fetched-stars-graphql.json
//   METADATA_BATCH_SIZE   default 25
//
// Writes:
//   OUTPUT_FILE  — JSON array of FetchedRepo
//   $GITHUB_OUTPUT — total_repos, archived_count, fork_count,
//                    no_description_count, output_file, output_bytes,
//                    partial_failure_reason, resume_cursor, pages_fetched,
//                    batches_fetched, blocked_orgs (csv)
//   stderr  — info/warning lines for the runner log

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname } from 'node:path';
import process from 'node:process';
import { createOctokit } from './octokit-client.js';
import { fetchStars } from './fetch-stars.js';
import { DEFAULT_METADATA_BATCH_SIZE } from './metadata-batcher.js';

function envOrDefault(key: string, dflt: string): string {
  const v = process.env[key];
  return v && v.trim() ? v.trim() : dflt;
}

function setOutput(line: string): void {
  const out = process.env.GITHUB_OUTPUT;
  if (!out) return;
  appendFileSync(out, line + '\n');
}

async function main(): Promise<void> {
  const token = process.env.GH_TOKEN;
  if (!token) {
    console.error('GH_TOKEN env required for src/fetch/cli.ts');
    process.exit(2);
  }

  const LIST_QUERY_PATH = envOrDefault('LIST_QUERY_PATH', 'queries/stars-list-query.graphql');
  const FRAGMENT_PATH = envOrDefault('METADATA_FRAGMENT_PATH', 'queries/stars-metadata-fragment.graphql');
  const OUTPUT_FILE = envOrDefault('OUTPUT_FILE', '.github-stars/data/fetched-stars-graphql.json');
  const BATCH_SIZE = parseInt(envOrDefault('METADATA_BATCH_SIZE', String(DEFAULT_METADATA_BATCH_SIZE)), 10);
  const resumeCursor = (process.env.RESUME_CURSOR || '').trim() || null;

  for (const p of [LIST_QUERY_PATH, FRAGMENT_PATH]) {
    if (!existsSync(p)) {
      console.error(`Required query file not found: ${p}`);
      process.exit(2);
    }
  }
  const listQuery = readFileSync(LIST_QUERY_PATH, 'utf8');
  const metadataFragment = readFileSync(FRAGMENT_PATH, 'utf8');

  const octokit = createOctokit({ token, retries: 5 });

  const log = (m: string) => process.stderr.write(m + '\n');
  const warn = (m: string) => process.stderr.write(`::warning::${m}\n`);

  const result = await fetchStars({
    octokit,
    listQuery,
    metadataFragment,
    resumeCursor,
    batchSize: BATCH_SIZE,
    log,
    warn,
  });

  // Write output JSON regardless of partial-failure so it remains uploadable.
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(result.repos, null, 2));
  const outputBytes = statSync(OUTPUT_FILE).size;

  const archived = result.repos.filter((r) => r.archived).length;
  const forks = result.repos.filter((r) => r.fork).length;
  const noDesc = result.repos.filter((r) => !r.description).length;

  log(`Total: ${result.repos.length} repositories — list pages=${result.pageCount} metadata batches=${result.batchCount}`);
  log(`Archived: ${archived}, Forks: ${forks}, No description: ${noDesc}`);

  setOutput(`total_repos=${result.repos.length}`);
  setOutput(`archived_count=${archived}`);
  setOutput(`fork_count=${forks}`);
  setOutput(`no_description_count=${noDesc}`);
  setOutput(`output_file=${OUTPUT_FILE}`);
  setOutput(`output_bytes=${outputBytes}`);
  setOutput(`partial_failure_reason=${result.partialFailureReason}`);
  setOutput(`pages_fetched=${result.pageCount}`);
  setOutput(`batches_fetched=${result.batchCount}`);
  setOutput(`resume_cursor=${result.lastEndCursor ?? ''}`);
  setOutput(`blocked_orgs=${result.inaccessibleOrgs.join(',')}`);

  if (result.partialFailureReason) {
    console.error(
      `::error::Star fetch incomplete: ${result.partialFailureReason}. ` +
        `Wrote ${result.repos.length} partial repos to ${OUTPUT_FILE} (${outputBytes} bytes). ` +
        `To resume, dispatch with input resume_cursor='${result.lastEndCursor ?? ''}'.`
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`fetch-stars cli crashed: ${err?.stack ?? err}`);
  process.exit(1);
});
