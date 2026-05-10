// Orchestrates list pagination + metadata batches.

import { paginateStarList } from './list-paginator.js';
import { fetchMetadataInBatches, DEFAULT_METADATA_BATCH_SIZE } from './metadata-batcher.js';
import type { OctokitClient } from './octokit-client.js';
import type { FetchOutcome } from './types.js';

export type FetchStarsOptions = {
  octokit: OctokitClient;
  listQuery: string;
  metadataFragment: string;
  resumeCursor: string | null;
  batchSize?: number;
  log?: (msg: string) => void;
  warn?: (msg: string) => void;
};

export async function fetchStars(opts: FetchStarsOptions): Promise<FetchOutcome> {
  const log = opts.log ?? (() => {});
  const warn = opts.warn ?? (() => {});

  log('Stage 1: paginating star list (cheap query)...');
  const stage1 = await paginateStarList({
    octokit: opts.octokit,
    query: opts.listQuery,
    resumeCursor: opts.resumeCursor,
    log,
    warn,
  });

  if (stage1.partialFailureReason) {
    return {
      repos: [],
      pageCount: stage1.pageCount,
      batchCount: 0,
      lastEndCursor: stage1.lastEndCursor,
      inaccessibleOrgs: [...stage1.inaccessibleOrgs].sort(),
      partialFailureReason: stage1.partialFailureReason,
    };
  }

  log(`Stage 1 done: ${stage1.list.length} public stars across ${stage1.pageCount} pages.`);
  if (stage1.inaccessibleOrgs.size > 0) {
    warn(
      `Skipped ${stage1.inaccessibleOrgs.size} orgs that block classic-PAT access: ` +
        `${[...stage1.inaccessibleOrgs].sort().join(', ')}. ` +
        `To include them, switch to a fine-grained PAT or GitHub App.`
    );
  }

  log(`Stage 2: fetching metadata in batches of ${opts.batchSize ?? DEFAULT_METADATA_BATCH_SIZE}...`);
  const stage2 = await fetchMetadataInBatches({
    octokit: opts.octokit,
    fragment: opts.metadataFragment,
    list: stage1.list,
    batchSize: opts.batchSize,
    log,
    warn,
  });

  // Combine blocked-org sets across stages.
  const blocked = new Set<string>([...stage1.inaccessibleOrgs, ...stage2.blockedOrgs]);

  // Tolerance: if stage2 left repos unfetched, only treat as success when the
  // gap matches the count of skipped blocked-org repos (≤10% tolerance).
  let partialFailureReason = stage2.partialFailureReason;
  const gap = stage1.list.length - stage2.repos.length;
  if (!partialFailureReason && gap > 0) {
    if (blocked.size > 0 && gap < stage1.list.length * 0.1) {
      log(`Stage 2 expected gap: ${gap} repos in classic-PAT-blocked orgs (${blocked.size} orgs).`);
    } else {
      partialFailureReason = `metadata_incomplete_${stage2.repos.length}_of_${stage1.list.length}_gap=${gap}`;
      warn(
        `Stage 2 left ${gap} repos unfetched, more than the ${blocked.size} blocked orgs explain.`
      );
    }
  }

  return {
    repos: stage2.repos,
    pageCount: stage1.pageCount,
    batchCount: stage2.batchCount,
    lastEndCursor: stage1.lastEndCursor,
    inaccessibleOrgs: [...blocked].sort(),
    partialFailureReason,
  };
}
