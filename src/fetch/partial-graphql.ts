// Partial-GraphQL handling.
//
// @octokit/graphql throws GraphqlResponseError when response.data.errors
// is populated, but preserves response.data on the error object
// (refs/octokit/.../@octokit/graphql/dist-src/error.js L11-12 sets
// this.data = response.data). For org-blocked classic-PAT errors,
// GitHub returns the page that succeeded plus per-repo error entries.
// This module classifies and extracts both shapes.

const ORG_BLOCKED_REGEX =
	/^`([^`]+)` forbids access via a personal access token \(classic\)/;
const MAX_ERROR_MSG_LENGTH = 200;

/**
 * Result of dissecting a `GraphqlResponseError`. The `data` field
 * holds whatever GitHub still returned for the partial-success path
 * (e.g. the page that succeeded before per-repo errors fired); the
 * other two arrays classify the errors GitHub raised.
 *
 * @public
 */
export type PartialClassification = {
	/** Best-effort partial data the caller can still use. null = nothing usable. */
	data: unknown;
	/** Org names that block classic-PAT access. Caller accumulates across pages. */
	blockedOrgs: string[];
	/** Other GraphQL error messages (truncated). */
	otherErrors: string[];
};

/**
 * Inspect a thrown value and decide whether it carries partial data
 * worth keeping (the org-blocked-PAT pattern returns a populated `data`
 * alongside per-repo error entries). Returns null when the input is
 * not a recognisable `GraphqlResponseError`.
 *
 * @remarks
 * The shape is per `refs/octokit/.../@octokit/graphql/dist-src/error.js`
 * L11-12 — the error object preserves `response.data` so consumers can
 * read whatever did succeed before unwinding.
 *
 * @param error - The thrown value to classify.
 * @returns Classified partial result, or `null` when nothing usable.
 *
 * @public
 */
export function classifyPartial(error: unknown): PartialClassification | null {
	if (!error || typeof error !== "object") return null;
	const e = error as { data?: unknown; errors?: Array<{ message?: string }> };
	if (e.data == null && e.errors == null) return null;

	const blockedOrgs: string[] = [];
	const otherErrors: string[] = [];
	for (const item of e.errors ?? []) {
		const msg = (item?.message ?? "").toString();
		const m = msg.match(ORG_BLOCKED_REGEX);
		if (m) blockedOrgs.push(m[1]);
		else otherErrors.push(msg.substring(0, MAX_ERROR_MSG_LENGTH));
	}
	return { data: e.data ?? null, blockedOrgs, otherErrors };
}

/**
 * True when the thrown value's message contains GitHub's "Bad
 * credentials" string. Used by paginators to short-circuit the loop
 * with a structured `partialFailureReason`.
 *
 * @public
 */
export function isBadCredentials(error: unknown): boolean {
	const msg = (error as { message?: unknown })?.message;
	return typeof msg === "string" && msg.includes("Bad credentials");
}

/**
 * Extract the HTTP status code from a thrown Octokit error, falling
 * back to the literal string `"n/a"` when no numeric status is
 * present. The string form is interpolated directly into log lines.
 *
 * @public
 */
export function errorStatus(error: unknown): number | string {
	const s = (error as { status?: unknown })?.status;
	return typeof s === "number" ? s : "n/a";
}

/**
 * Extract the error message, truncated to a safe length for logging.
 * Falls back to `String(error)` when the value is not a standard Error.
 *
 * @public
 */
export function errorMessage(error: unknown): string {
	const m = (error as { message?: unknown })?.message;
	const s = typeof m === "string" ? m : String(error);
	return s.substring(0, MAX_ERROR_MSG_LENGTH);
}
