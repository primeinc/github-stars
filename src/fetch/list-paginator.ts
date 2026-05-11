// Stage 1: cheap pagination of viewer.starredRepositories.
// Per GitHub's published guidance — refs/github/docs/.../
// rate-limits-and-query-limits-for-the-graphql-api.md L286-294
// (10s timeout) and L308-316 ("Split large queries"), and the
// pagination guide L49 ("request fewer items if your query touches
// a lot of data") — we intentionally fetch only nameWithOwner +
// isPrivate + starredAt at first:100. Local repro: <3.5s/page.

import type {
	PageInfo,
	Repository,
	StarredRepositoryEdge,
} from "@octokit/graphql-schema";
import type { OctokitClient } from "./octokit-client.js";
import {
	classifyPartial,
	errorMessage,
	errorStatus,
	isBadCredentials,
} from "./partial-graphql.js";
import type { StarListEntry } from "./types.js";

/**
 * Shape of one `viewer.starredRepositories` page returned by the
 * GraphQL list query. Carries just enough to feed stage 2 — the
 * full per-repo metadata is fetched in batched per-repo queries.
 *
 * Field types are derived as `Pick<>` projections from the canonical
 * {@link https://github.com/octokit/graphql-schema | @octokit/graphql-schema}
 * types so a schema rename (e.g. `nameWithOwner` → `nameWithOwnerPath`)
 * fails this file at compile time. The selection set in
 * `queries/stars-list-query.graphql` and this projection must move in
 * lockstep.
 *
 * @public
 */
export type ListPageResult = {
	edges: Array<
		Pick<StarredRepositoryEdge, "starredAt"> & {
			node: Pick<Repository, "nameWithOwner" | "isPrivate">;
		}
	>;
	pageInfo: Pick<PageInfo, "hasNextPage" | "endCursor">;
	totalCount: number;
};

/**
 * Aggregate result of one full GraphQL pagination run. `lastEndCursor`
 * is the cursor of the last successfully-fetched page — workflows
 * forward it as `RESUME_CURSOR=` on retry. `inaccessibleOrgs` carries
 * the org names blocked by classic-PAT access (not surfaced in public
 * outputs per session-oracle verdict rule 8; the count is).
 *
 * @public
 */
export type ListPaginationOutcome = {
	list: StarListEntry[];
	pageCount: number;
	lastEndCursor: string | null;
	inaccessibleOrgs: Set<string>;
	partialFailureReason: string;
};

/**
 * Options for {@link paginateStarList}. The query body is supplied so
 * tests can substitute a stub query without coupling this layer to
 * the on-disk `queries/stars-list-query.graphql` path.
 *
 * @public
 */
export type ListPaginationOptions = {
	octokit: OctokitClient;
	query: string;
	resumeCursor: string | null;
	/** Logger; default no-op. Useful in tests. */
	log?: (msg: string) => void;
	warn?: (msg: string) => void;
};

/**
 * Canonical bad-credentials error message. Identical text used by both
 * paginators so workflow log search keys on a single literal.
 *
 * @public
 */
export const BAD_CREDENTIALS_ERROR =
	"Authentication failed: Bad credentials. " +
	"The configured token is expired, revoked, or insufficient. " +
	"See setup-doctor output for the active auth_mode and missing_config.";

/**
 * Paginate `viewer.starredRepositories` via GraphQL. Used in PAT and
 * GITHUB_TOKEN modes — both carry user context so `viewer` resolves.
 * App installation tokens take the
 * {@link "./list-paginator-rest".paginateStarListViaRest | REST path}
 * instead because installation tokens have no user context.
 *
 * @param opts - Pre-authenticated client + GraphQL query + cursor.
 * @returns The accumulated star list plus the cursor for resume.
 *
 * @public
 */
export async function paginateStarList(
	opts: ListPaginationOptions,
): Promise<ListPaginationOutcome> {
	const log = opts.log ?? (() => {});
	const warn = opts.warn ?? (() => {});

	const list: StarListEntry[] = [];
	const inaccessibleOrgs = new Set<string>();
	let pageCount = 0;
	let cursor: string | null = opts.resumeCursor;
	let lastEndCursor: string | null = opts.resumeCursor;
	let hasNextPage = true;
	let partialFailureReason = "";

	while (hasNextPage) {
		pageCount++;
		let page: ListPageResult | null = null;

		try {
			const response = await opts.octokit.graphql<{
				viewer: { starredRepositories: ListPageResult };
			}>(opts.query, { cursor });
			page = response.viewer.starredRepositories;
		} catch (error: unknown) {
			if (isBadCredentials(error)) {
				partialFailureReason = `bad_credentials_at_page_${pageCount}`;
				warn(BAD_CREDENTIALS_ERROR);
				break;
			}
			const partial = classifyPartial(error);
			const partialList =
				(
					partial?.data as {
						viewer?: { starredRepositories?: ListPageResult };
					} | null
				)?.viewer?.starredRepositories ?? null;
			// `partialList` is only truthy when `partial.data.viewer.starredRepositories`
			// resolved to something — which transitively means `partial` itself is
			// defined. Narrow on both so the loop body sees `partial` as non-null
			// (closes biome noUnsafeOptionalChaining at L87).
			if (partialList && partial) {
				page = partialList;
				for (const org of partial.blockedOrgs) inaccessibleOrgs.add(org);
				warn(
					`page ${pageCount}: partial response (${partial.blockedOrgs.length} blocked, ` +
						`${partial.otherErrors.length} other; continuing). ` +
						(partial.otherErrors[0] ? `Sample: ${partial.otherErrors[0]}` : ""),
				);
			} else {
				partialFailureReason = `list_error_at_page_${pageCount}_after_${list.length}_repos_status=${errorStatus(error)}_msg=${errorMessage(error)}`;
				warn(
					`Stage 1 list query failed at page ${pageCount}: ${errorMessage(error)}. ` +
						`Cursor for resume: ${lastEndCursor ?? "null"}.`,
				);
				break;
			}
		}

		if (!page) break;

		for (const edge of page.edges ?? []) {
			if (edge?.node && !edge.node.isPrivate) {
				list.push({
					repo: edge.node.nameWithOwner,
					user_starred_at: edge.starredAt,
				});
			}
		}
		// `endCursor` is `Maybe<string>` on the canonical PageInfo
		// (string | null | undefined). Coalesce to `string | null` so
		// the local cursor type stays narrow.
		lastEndCursor = page.pageInfo.endCursor ?? null;
		hasNextPage = page.pageInfo.hasNextPage;
		cursor = lastEndCursor;
		if (pageCount % 5 === 0) {
			log(`  list page ${pageCount}: total=${list.length}/${page.totalCount}`);
		}
	}

	return {
		list,
		pageCount,
		lastEndCursor,
		inaccessibleOrgs,
		partialFailureReason,
	};
}
