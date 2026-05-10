// CLI: invoked by .github/workflows/02-sync-stars.yml as the sync step.
// Reads the fetched-stars JSON + the existing manifest, runs reconcile,
// and writes the updated manifest back to repos.yml.
//
// Env:
//   FETCHED_STARS_PATH   default .github-stars/data/fetched-stars-graphql.json
//   MANIFEST_PATH        default repos.yml
//   GITHUB_USER          override manifest_metadata.github_user
//   MANIFEST_REMOVAL_OVERRIDE  set to 'true' to bypass 5% destructive-deletion guard
//   GITHUB_OUTPUT        if present, writes:
//                          changed, total_new, total_removed, total_updated,
//                          total_repos, removal_ratio, destructive_refused

import { appendFileSync, readFileSync } from 'node:fs';
import process from 'node:process';
import { reconcile } from './reconcile.js';
import { loadManifest, writeManifest } from './manifest-io.js';
import type { FetchedRepo } from '../fetch/types.js';

function envOrDefault(key: string, dflt: string): string {
  const v = process.env[key];
  return v && v.trim() ? v.trim() : dflt;
}

function setOutput(line: string): void {
  const out = process.env.GITHUB_OUTPUT;
  if (!out) return;
  appendFileSync(out, line + '\n');
}

function main(): void {
  const FETCHED_STARS_PATH = envOrDefault('FETCHED_STARS_PATH', '.github-stars/data/fetched-stars-graphql.json');
  const MANIFEST_PATH = envOrDefault('MANIFEST_PATH', 'repos.yml');
  const githubUser = (process.env.GITHUB_USER || '').trim() || undefined;
  const removalOverride = (process.env.MANIFEST_REMOVAL_OVERRIDE || '').trim().toLowerCase() === 'true';

  const fetched: FetchedRepo[] = JSON.parse(readFileSync(FETCHED_STARS_PATH, 'utf8'));
  if (!Array.isArray(fetched)) {
    console.error(`::error::Invalid fetched-stars data at ${FETCHED_STARS_PATH}: expected array`);
    process.exit(2);
  }
  console.error(`Loaded ${fetched.length} fetched repos from ${FETCHED_STARS_PATH}`);

  const manifest = loadManifest(MANIFEST_PATH);
  console.error(`Loaded manifest with ${manifest.repositories.length} repos from ${MANIFEST_PATH}`);

  const result = reconcile({ manifest, fetched, githubUser, removalOverride });
  if (result.kind === 'destructive') {
    console.error(`::error::${result.reason}`);
    setOutput('changed=false');
    setOutput('destructive_refused=true');
    setOutput(`removal_ratio=${result.stats.removal_ratio}`);
    setOutput(`total_removed=${result.stats.total_removed}`);
    setOutput(`total_repos=${result.stats.total_repos}`);
    process.exit(1);
  }

  if (result.stats.changed) {
    writeManifest(MANIFEST_PATH, result.manifest);
    console.error(
      `Wrote ${MANIFEST_PATH}: ${result.stats.total_new} new, ${result.stats.total_removed} removed, ${result.stats.total_updated} updated → ${result.stats.total_repos} total`
    );
  } else {
    console.error('No changes to write.');
  }

  setOutput(`changed=${result.stats.changed ? 'true' : 'false'}`);
  setOutput(`total_new=${result.stats.total_new}`);
  setOutput(`total_removed=${result.stats.total_removed}`);
  setOutput(`total_updated=${result.stats.total_updated}`);
  setOutput(`total_repos=${result.stats.total_repos}`);
  setOutput(`removal_ratio=${result.stats.removal_ratio}`);
  setOutput('destructive_refused=false');
}

try {
  main();
} catch (err) {
  console.error(`sync cli crashed: ${(err as Error)?.stack ?? err}`);
  process.exit(1);
}
