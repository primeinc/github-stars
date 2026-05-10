// Orchestrates list pagination + metadata batches.
//
// Stage 1 (list-only) has TWO implementations chosen by selected_mode:
//
//   pat / github_token mode -> GraphQL `viewer.starredRepositories`
//                              (list-paginator.ts). Uses user-context auth;
//                              works because PAT and GITHUB_TOKEN both
//                              carry user identity.
//
//   github_app mode         -> REST `/users/{username}/starred`
//                              (list-paginator-rest.ts). Required because
//                              App installation tokens have no user context;
//                              first-party progAccess docs confirm
//                              `viewer.starredRepositories` is
//                              serverToServer:false but
//                              `/users/:username/starred` is
//                              serverToServer:true.
//                              See list-paginator-rest.ts header for citations.
//
// Stage 2 (per-repo metadata) is GraphQL aliased batches in BOTH modes —
// `repository(owner, name)` is serverToServer:true so installation tokens
// work fine.
//
// This is the ONLY place mode-specific code lives. Both downstream stages
// see the same StarListEntry[] shape regardless of which paginator ran.

import { paginateStarList } from './list-paginator.js';
import { paginateStarListViaRest, parseRestResumeToken } from './list-paginator-rest.js';
import { fetchMetadataInBatches, DEFAULT_METADATA_BATCH_SIZE } from './metadata-batcher.js';
import type { OctokitClient } from './octokit-client.js';
import type { FetchOutcome } from './types.js';

export type SelectedMode = 'github_app' | 'pat' | 'github_token';

export type FetchStarsOptions = {
  octokit: OctokitClient;
  /** Drives which stage-1 implementation runs. */
  selectedMode: SelectedMode;
  /** Required when selectedMode === 'github_app' (REST endpoint takes a username). */
  starSourceUser: string;
  /** GraphQL list query (used by pat/github_token modes). */
  listQuery: string;
  /** GraphQL fragment (used by stage 2 in ALL modes). */
  metadataFragment: string;
  /**
   * Resume token. Opaque to the caller:
   *   - pat/github_token modes: GraphQL endCursor string
   *   - github_app mode: REST page number as string
   * Each paginator interprets its own format.
   */
  resumeCursor: string | null;
  batchSize?: number;
  log?: (msg: string) => void;
  warn?: (msg: string) => void;
};

export async function fetchStars(opts: FetchStarsOptions): Promise<FetchOutcome> {
  const log = opts.log ?? (() => {});
  const warn = opts.warn ?? (() => {});

  log(`Stage 1: paginating star list (mode=${opts.selectedMode})...`);

  // Stage 1: branch on selected_mode. The "no mixed auth" doctrine is
  // honored because both branches use opts.octokit, which the workflow
  // built from selected_mode's credential. The branch picks an ENDPOINT,
  // not a credential.
  let stage1List: Array<{ repo: string; user_starred_at: string }>;
  let stage1PageCount: number;
  let stage1ResumeToken: string | null;
  let stage1BlockedOrgs: Set<string>;
  let stage1PartialFailure: string;

  if (opts.selectedMode === 'github_app') {
    if (!opts.starSourceUser) {
      throw new Error('github_app mode requires starSourceUser (REST /users/{username}/starred path needs a username)');
    }
    const r = await paginateStarListViaRest({
      octokit: opts.octokit,
      username: opts.starSourceUser,
      startPage: parseRestResumeToken(opts.resumeCursor),
      log,
      warn,
    });
    stage1List = r.list;
    stage1PageCount = r.pageCount;
    stage1ResumeToken = r.resumeToken;
    stage1BlockedOrgs = r.inaccessibleOrgs;
    stage1PartialFailure = r.partialFailureReason;
  } else {
    const r = await paginateStarList({
      octokit: opts.octokit,
      query: opts.listQuery,
      resumeCursor: opts.resumeCursor,
      log,
      warn,
    });
    stage1List = r.list;
    stage1PageCount = r.pageCount;
    stage1ResumeToken = r.lastEndCursor;
    stage1BlockedOrgs = r.inaccessibleOrgs;
    stage1PartialFailure = r.partialFailureReason;
  }

  if (stage1PartialFailure) {
    return {
      repos: [],
      pageCount: stage1PageCount,
      batchCount: 0,
      lastEndCursor: stage1ResumeToken,
      blockedOrgsCount: stage1BlockedOrgs.size,
      partialFailureReason: stage1PartialFailure,
    };
  }

  log(`Stage 1 done: ${stage1List.length} public stars across ${stage1PageCount} pages.`);
  if (stage1BlockedOrgs.size > 0) {
    // Per session-oracle verdict rule 8: do NOT print blocked org NAMES
    // in public workflow logs. Names are private/internal source identifiers
    // for the user's stars and may be sensitive. Count is fine.
    warn(
      `Skipped ${stage1BlockedOrgs.size} org(s) that block classic-PAT access ` +
        `(names redacted from public log).`
    );
  }

  log(`Stage 2: fetching metadata in batches of ${opts.batchSize ?? DEFAULT_METADATA_BATCH_SIZE}...`);
  const stage2 = await fetchMetadataInBatches({
    octokit: opts.octokit,
    fragment: opts.metadataFragment,
    list: stage1List,
    batchSize: opts.batchSize,
    log,
    warn,
  });

  const blocked = new Set<string>([...stage1BlockedOrgs, ...stage2.blockedOrgs]);

  let partialFailureReason = stage2.partialFailureReason;
  const gap = stage1List.length - stage2.repos.length;
  if (!partialFailureReason && gap > 0) {
    if (blocked.size > 0 && gap < stage1List.length * 0.1) {
      log(`Stage 2 expected gap: ${gap} repos in classic-PAT-blocked orgs (${blocked.size} orgs).`);
    } else {
      partialFailureReason = `metadata_incomplete_${stage2.repos.length}_of_${stage1List.length}_gap=${gap}`;
      warn(
        `Stage 2 left ${gap} repos unfetched, more than the ${blocked.size} blocked orgs explain.`
      );
    }
  }

  return {
    repos: stage2.repos,
    pageCount: stage1PageCount,
    batchCount: stage2.batchCount,
    lastEndCursor: stage1ResumeToken,
    blockedOrgsCount: blocked.size,
    partialFailureReason,
  };
}
