// Stage 1: cheap pagination of viewer.starredRepositories.
// Per GitHub's published guidance — refs/github/docs/.../
// rate-limits-and-query-limits-for-the-graphql-api.md L286-294
// (10s timeout) and L308-316 ("Split large queries"), and the
// pagination guide L49 ("request fewer items if your query touches
// a lot of data") — we intentionally fetch only nameWithOwner +
// isPrivate + starredAt at first:100. Local repro: <3.5s/page.

import type { OctokitClient } from './octokit-client.js';
import type { StarListEntry } from './types.js';
import { classifyPartial, errorMessage, errorStatus, isBadCredentials } from './partial-graphql.js';

export type ListPageResult = {
  edges: Array<{ node: { nameWithOwner: string; isPrivate: boolean }; starredAt: string }>;
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  totalCount: number;
};

export type ListPaginationOutcome = {
  list: StarListEntry[];
  pageCount: number;
  lastEndCursor: string | null;
  inaccessibleOrgs: Set<string>;
  partialFailureReason: string;
};

export type ListPaginationOptions = {
  octokit: OctokitClient;
  query: string;
  resumeCursor: string | null;
  /** Logger; default no-op. Useful in tests. */
  log?: (msg: string) => void;
  warn?: (msg: string) => void;
};

export const BAD_CREDENTIALS_ERROR =
  'Authentication failed: Bad credentials. ' +
  'The configured token is expired, revoked, or insufficient. ' +
  'See setup-doctor output for the active auth_mode and missing_config.';

export async function paginateStarList(opts: ListPaginationOptions): Promise<ListPaginationOutcome> {
  const log = opts.log ?? (() => {});
  const warn = opts.warn ?? (() => {});

  const list: StarListEntry[] = [];
  const inaccessibleOrgs = new Set<string>();
  let pageCount = 0;
  let cursor: string | null = opts.resumeCursor;
  let lastEndCursor: string | null = opts.resumeCursor;
  let hasNextPage = true;
  let partialFailureReason = '';

  while (hasNextPage) {
    pageCount++;
    let page: ListPageResult | null = null;

    try {
      const response = await opts.octokit.graphql<{ viewer: { starredRepositories: ListPageResult } }>(
        opts.query,
        { cursor }
      );
      page = response.viewer.starredRepositories;
    } catch (error: unknown) {
      if (isBadCredentials(error)) {
        partialFailureReason = `bad_credentials_at_page_${pageCount}`;
        warn(BAD_CREDENTIALS_ERROR);
        break;
      }
      const partial = classifyPartial(error);
      const partialList = (partial?.data as { viewer?: { starredRepositories?: ListPageResult } } | null)
        ?.viewer?.starredRepositories ?? null;
      if (partialList) {
        page = partialList;
        for (const org of partial!.blockedOrgs) inaccessibleOrgs.add(org);
        warn(
          `page ${pageCount}: partial response (${partial!.blockedOrgs.length} blocked, ` +
            `${partial!.otherErrors.length} other; continuing). ` +
            (partial!.otherErrors[0] ? `Sample: ${partial!.otherErrors[0]}` : '')
        );
      } else {
        partialFailureReason =
          `list_error_at_page_${pageCount}_after_${list.length}_repos_status=${errorStatus(error)}_msg=${errorMessage(error)}`;
        warn(
          `Stage 1 list query failed at page ${pageCount}: ${errorMessage(error)}. ` +
            `Cursor for resume: ${lastEndCursor ?? 'null'}.`
        );
        break;
      }
    }

    if (!page) break;

    for (const edge of page.edges ?? []) {
      if (edge?.node && !edge.node.isPrivate) {
        list.push({ repo: edge.node.nameWithOwner, user_starred_at: edge.starredAt });
      }
    }
    lastEndCursor = page.pageInfo.endCursor;
    hasNextPage = page.pageInfo.hasNextPage;
    cursor = lastEndCursor;
    if (pageCount % 5 === 0) {
      log(`  list page ${pageCount}: total=${list.length}/${page.totalCount}`);
    }
  }

  return { list, pageCount, lastEndCursor, inaccessibleOrgs, partialFailureReason };
}
