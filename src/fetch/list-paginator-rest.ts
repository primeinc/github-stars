// Stage 1 (App-mode): REST `GET /users/{username}/starred` paginator.
//
// Why REST instead of the GraphQL paginator used by pat-mode?
//
// First-party evidence from refs/github/docs/src/rest/data/fpt-2026-03-10/
// activity.json:
//
//   GET /user/starred (the AUTHENTICATED-user form):
//     progAccess.serverToServer = false   <- App installation token CANNOT call
//     progAccess.userToServerRest = true  <- needs OAuth user-to-server
//
//   GET /users/{username}/starred (the SPECIFIC-user form):
//     progAccess.serverToServer = true    <- App installation token CAN call
//     progAccess.userToServerRest = true
//     progAccess.allowsPublicRead = true
//
// GraphQL `viewer.starredRepositories` is the "authenticated user" shape
// (same boundary as `/user/starred`); App installation tokens have no
// user context, so the GraphQL path returns INSUFFICIENT_SCOPES. The
// `/users/{username}/starred` endpoint is `serverToServer: true` and
// the App installation token authenticates it cleanly. That's why
// github_app mode uses REST for stage 1, while pat mode keeps GraphQL.
//
// Stage 2 (per-repo metadata) stays GraphQL in BOTH modes because
// `repository(owner, name)` IS `serverToServer: true` (App installation
// tokens can read it).
//
// Custom Accept header `application/vnd.github.star+json` makes the
// response shape `[{ starred_at, repo: {...} }]` instead of the default
// `[ {repo fields directly} ]`. We need starred_at to populate
// StarListEntry.user_starred_at — same field 02-sync's reconcile reads.

import type { components } from "@octokit/openapi-types";
import { BAD_CREDENTIALS_ERROR } from "./list-paginator.js";
import type { OctokitClient } from "./octokit-client.js";
import {
	errorMessage,
	errorStatus,
	isBadCredentials,
} from "./partial-graphql.js";
import type { StarListEntry } from "./types.js";

/**
 * One element of the `GET /users/{username}/starred` response when the
 * `application/vnd.github.star+json` Accept header is set — the wrapper
 * shape that splits out the star timestamp from the repo body.
 *
 * Re-exported as the canonical type alias over
 * `components["schemas"]["starred-repository"]` from
 * {@link https://github.com/octokit/openapi-types.ts | @octokit/openapi-types}
 * so the repo never carries a hand-rolled GitHub API shape.
 *
 * @public
 */
export type RestStarItem = components["schemas"]["starred-repository"];

/**
 * Aggregate result of one full REST pagination run. Mirrors
 * {@link "./list-paginator".ListPaginationOutcome} so consumers (the
 * orchestrator in `fetch-stars.ts`) can branch on selected mode
 * without reshape.
 *
 * @public
 */
export type RestPaginationOutcome = {
	list: StarListEntry[];
	pageCount: number;
	/**
	 * REST pagination uses page numbers, not opaque cursors. We surface
	 * the next page number on partial failure so the workflow can resume.
	 * The doctor/workflow exposes this in the same `resume_cursor` slot
	 * for symmetry with the GraphQL paginator; the consumer treats it as
	 * an opaque token.
	 */
	resumeToken: string | null;
	/**
	 * Per session-oracle verdict rule 8: count only, no names. The REST
	 * endpoint does not surface "this org blocks classic-PAT" errors the
	 * way GraphQL does (App installation tokens hit a different access
	 * control surface), so this is essentially always 0 under App mode.
	 * Kept for shape parity with the GraphQL paginator.
	 */
	inaccessibleOrgs: Set<string>;
	partialFailureReason: string;
};

/**
 * Options for {@link paginateStarListViaRest}. `username` is required
 * because installation tokens have no user context — the workflow
 * forwards `STAR_SOURCE_USER` (typed via
 * {@link "../contracts/env".GhStarsEnv}) to satisfy this.
 *
 * @public
 */
export type RestPaginationOptions = {
	octokit: OctokitClient;
	username: string;
	/** REST page number to start from (1-based). Default: 1. */
	startPage?: number;
	/** per_page, max 100 per docs. Default: 100. */
	perPage?: number;
	log?: (msg: string) => void;
	warn?: (msg: string) => void;
};

const DEFAULT_PER_PAGE = 100;

/**
 * Paginate `GET /users/{username}/starred` via REST. Used in
 * `github_app` mode because the GraphQL `viewer.starredRepositories`
 * path is `serverToServer: false` — App installation tokens cannot
 * call it. The REST path is `serverToServer: true` per first-party
 * GitHub OpenAPI metadata.
 *
 * @param opts - Pre-authenticated client + username + start page.
 * @returns The accumulated star list plus the page-number resume token.
 *
 * @public
 */
export async function paginateStarListViaRest(
	opts: RestPaginationOptions,
): Promise<RestPaginationOutcome> {
	const log = opts.log ?? (() => {});
	const warn = opts.warn ?? (() => {});
	const perPage = opts.perPage ?? DEFAULT_PER_PAGE;
	const startPage = opts.startPage ?? 1;

	const list: StarListEntry[] = [];
	const inaccessibleOrgs = new Set<string>();
	let pageCount = 0;
	let page = startPage;
	let partialFailureReason = "";

	// Loop until a page returns fewer than perPage items (last page) or
	// an empty array (past last page). REST gives no cursor — we count.
	while (true) {
		pageCount++;
		let items: RestStarItem[] | null = null;

		try {
			const res = await opts.octokit.request("GET /users/{username}/starred", {
				username: opts.username,
				per_page: perPage,
				page,
				// Custom media type per refs/github/docs/.../activity.json:91868:
				// "application/vnd.github.star+json: Includes a timestamp of when
				// the star was created."
				headers: { accept: "application/vnd.github.star+json" },
			});
			// The route returns
			// `components["schemas"]["starred-repository"][] |
			//  components["schemas"]["repository"][]` per the OpenAPI spec;
			// the `application/vnd.github.star+json` Accept header pins the
			// `starred-repository[]` branch (the wrapper shape carrying
			// `starred_at`). Per-element narrowing in the loop below keeps
			// the runtime guard honest.
			items = res.data as RestStarItem[];
		} catch (error: unknown) {
			if (isBadCredentials(error)) {
				partialFailureReason = `bad_credentials_at_page_${pageCount}`;
				warn(BAD_CREDENTIALS_ERROR);
				break;
			}
			partialFailureReason = `rest_list_error_at_page_${page}_after_${list.length}_repos_status=${errorStatus(error)}_msg=${errorMessage(error)}`;
			warn(
				`Stage 1 REST list failed at page ${page}: ${errorMessage(error)}. ` +
					`Resume from page=${page} on retry.`,
			);
			break;
		}

		if (!Array.isArray(items)) {
			partialFailureReason = `rest_list_invalid_response_at_page_${page}_type=${typeof items}`;
			warn(`Stage 1 REST list returned non-array at page ${page}.`);
			break;
		}

		for (const item of items) {
			if (
				item?.repo &&
				!item.repo.private &&
				typeof item.repo.full_name === "string"
			) {
				list.push({
					repo: item.repo.full_name,
					user_starred_at: item.starred_at,
				});
			}
		}

		if (pageCount % 5 === 0) {
			log(`  list page ${pageCount} (REST page=${page}): total=${list.length}`);
		}

		if (items.length < perPage) {
			// Last page (partial fill or empty == done).
			break;
		}
		page++;
	}

	return {
		list,
		pageCount,
		resumeToken: partialFailureReason ? String(page) : null,
		inaccessibleOrgs,
		partialFailureReason,
	};
}

/** Resume token is a page number string for REST; opaque to consumers. */
export function parseRestResumeToken(token: string | null): number {
	if (!token) return 1;
	const n = parseInt(token, 10);
	return Number.isFinite(n) && n >= 1 ? n : 1;
}
