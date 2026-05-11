// Quarantine helpers: filter/sanitize functions every public-mode
// workflow stage routes its repo lists, summaries, and prompts
// through. Per issue #74 — defense in depth, not first line of
// defense (the fetch path already drops private repos before they
// reach the manifest).
//
// The first-line filter is in `src/fetch/list-paginator.ts` and
// `src/fetch/list-paginator-rest.ts` — they skip records where
// `isPrivate` / `repo.private` is true. This module is the
// downstream tripwire: if a private record somehow slips through
// (manifest hand-edit, future code path, schema drift), the
// quarantine helpers detect it and either filter+report or fail
// closed depending on the call site's contract.

import type {
	OutputVisibility,
	PrivateOmissionReport,
} from "./private-quarantine.js";

/**
 * One repo entry as far as the quarantine is concerned. Mirrors the
 * minimal shape both the fetch pipeline and the classifier use; the
 * full FetchedRepo type from `src/fetch/types.ts` is wider than what
 * we need to evaluate visibility.
 *
 * @public
 */
export interface QuarantinedRepoLike {
	readonly repo: string;
	readonly private?: boolean;
}

/**
 * Result of running a batch through the quarantine. `kept` contains
 * the public-safe records; `omittedCount` is the aggregate that
 * workflow summaries may emit (per issue #74's allowed-output rule).
 * `omittedSlugs` is RETAINED IN-MEMORY for tests and internal
 * diagnostics ONLY — callers MUST NOT emit it to any external
 * surface in public mode.
 *
 * @public
 */
export interface QuarantineResult<T extends QuarantinedRepoLike> {
	readonly kept: ReadonlyArray<T>;
	readonly omittedCount: number;
	readonly omittedSlugs: ReadonlyArray<string>;
}

/**
 * Filter a batch of repo records under the given output visibility.
 *
 * - `public`: every record with `private === true` is removed; the
 *   slug enters `omittedSlugs` (in-memory) and `omittedCount`
 *   increments.
 * - `private`: every record passes through (private output context
 *   is allowed to surface private repos).
 * - `unknown`: treated as `public` for fail-closed semantics (per
 *   the issue's "unknown output visibility =\> fail closed" rule).
 *
 * @public
 */
export function quarantinePrivate<T extends QuarantinedRepoLike>(args: {
	readonly visibility: OutputVisibility;
	readonly batch: ReadonlyArray<T>;
}): QuarantineResult<T> {
	const { visibility, batch } = args;
	if (visibility === "private") {
		return { kept: batch, omittedCount: 0, omittedSlugs: [] };
	}
	const kept: T[] = [];
	const omittedSlugs: string[] = [];
	for (const r of batch) {
		if (r.private === true) {
			omittedSlugs.push(r.repo);
		} else {
			kept.push(r);
		}
	}
	return { kept, omittedCount: omittedSlugs.length, omittedSlugs };
}

/**
 * Build the public-safe omission report. Returned object contains
 * ONLY the count — slugs are never part of this surface even when
 * they are available in {@link QuarantineResult.omittedSlugs}.
 *
 * @public
 */
export function publicSafeOmissionReport(
	result: Pick<QuarantineResult<QuarantinedRepoLike>, "omittedCount">,
): PrivateOmissionReport {
	return { count: result.omittedCount };
}

/**
 * Scan an arbitrary string (workflow summary, log line, prompt body,
 * artifact JSON) for any of the supplied private slugs. Returns the
 * matched slugs, in order of first appearance. The intended use is
 * the sentinel leak test fixture: pass a known-private slug, run any
 * candidate emit, assert the result is empty.
 *
 * @public
 */
export function findPrivateSlugLeaks(
	text: string,
	slugs: ReadonlyArray<string>,
): ReadonlyArray<string> {
	const found: string[] = [];
	for (const slug of slugs) {
		if (text.includes(slug)) {
			found.push(slug);
		}
	}
	return found;
}

/**
 * Hard-fail variant: throws {@link PrivateLeakError} if any of the
 * supplied slugs appears in `text`. Use at every public-surface boundary
 * (artifact write, step-summary append, prompt build) to abort the
 * pipeline rather than emit a leak.
 *
 * @public
 */
export function assertNoPrivateLeak(
	text: string,
	slugs: ReadonlyArray<string>,
	context: string,
): void {
	const leaks = findPrivateSlugLeaks(text, slugs);
	if (leaks.length === 0) return;
	throw new PrivateLeakError(context, leaks);
}

/**
 * Thrown when a public-surface emit attempts to include a private
 * slug. The error message names the surface (`context`) and the
 * leaked slugs so the operator can trace + fix; the pipeline aborts
 * before the emit completes.
 *
 * @public
 */
export class PrivateLeakError extends Error {
	public readonly context: string;
	public readonly leakedSlugs: ReadonlyArray<string>;

	public constructor(context: string, leakedSlugs: ReadonlyArray<string>) {
		super(
			`PrivateLeakError: ${leakedSlugs.length} private slug(s) found in ${context}: ${leakedSlugs.join(", ")}`,
		);
		this.name = "PrivateLeakError";
		this.context = context;
		this.leakedSlugs = leakedSlugs;
	}
}
