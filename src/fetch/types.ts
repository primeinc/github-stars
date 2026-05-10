// Shape of one transformed repo entry the fetcher emits.
// Keep in sync with the schema 02-sync consumes.

/**
 * One transformed repository record produced by the fetcher and
 * consumed by 02-sync's reconcile step. Shape stays in lockstep with
 * `schemas/repos-schema.json`.
 *
 * @remarks
 * Nullable fields reflect upstream GitHub responses where the API
 * itself returns null (`disk_usage` for empty repos, `last_commit_sha`
 * for repos with no default-branch ref, etc.). The reconciler is
 * responsible for tolerating each null at the merge site, never for
 * substituting a default.
 *
 * @public
 */
export type FetchedRepo = {
	repo: string;
	description: string;
	language: string | null;
	topics: string[];
	archived: boolean;
	fork: boolean;
	private: boolean;
	stargazers_count: number;
	forks_count: number;
	updated_at: string | null;
	pushed_at: string | null;
	disk_usage: number | null;
	owner_avatar: string | null;
	html_url: string | null;
	default_branch: string;
	last_commit_sha: string | null;
	user_starred_at: string | null;
	homepage_url: string | null;
	is_mirror: boolean;
	mirror_url: string | null;
	license: string | null;
	latest_release: { tag: string; published_at: string } | null;
};

/**
 * Stage-1 list-paginator output element: just the repo identity plus
 * the user's star timestamp. Stage-2 metadata batches use this as
 * input to fetch the per-repo details that hydrate {@link FetchedRepo}.
 *
 * @public
 */
export type StarListEntry = { repo: string; user_starred_at: string };

/**
 * Aggregate result of a complete star-fetch run. Stage 1 (pagination)
 * produces the page count + cursor; stage 2 (metadata batches) produces
 * `repos` and `batchCount`. {@link partialFailureReason} is non-empty
 * iff the fetch could not complete, in which case the workflow must
 * hard-fail (per session-oracle verdict).
 *
 * @public
 */
export type FetchOutcome = {
	repos: FetchedRepo[];
	pageCount: number;
	batchCount: number;
	lastEndCursor: string | null;
	/**
	 * Count of orgs that block classic-PAT access. Repos in those orgs are
	 * skipped. Per session-oracle verdict rule 8: org NAMES are NEVER part
	 * of the public outcome surface (they may identify private/internal
	 * orgs the user has starred). Operator can re-run the fetcher with a
	 * verbose flag against a private artifact if names are needed.
	 */
	blockedOrgsCount: number;
	/** Non-empty when the fetch could not complete; workflow must hard-fail. */
	partialFailureReason: string;
};
