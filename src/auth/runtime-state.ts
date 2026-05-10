// Runtime fallback transition layer.
//
// Per session-oracle verdict rule 6: fallback is represented as
// effective_mode=github_token, NEVER as mixed role auth. This module
// is the ONLY place a fallback transition happens, and it produces a
// new EffectiveAuth where every role is the new credential class.
//
// Contract:
//   - github_app failure  -> always re-throws. No fallback. Ever.
//   - pat failure         -> if pat_fallback_to_github_token && a
//                            GITHUB_TOKEN is available at runtime, returns
//                            a new EffectiveAuth with effective_mode=
//                            github_token (every role flipped). Loud
//                            warning emitted via the supplied warn fn.
//                            Else re-throws.
//   - github_token failure -> always re-throws.
//
// The transition is OBSERVED — not hidden. The effective_mode field on
// EffectiveAuth is what every workflow output and summary reads.

import {
	assertNoMixedAuth,
	type EffectiveAuth,
	type ResolvedAuth,
} from "./auth-mode.js";

/**
 * Describes a runtime credential failure surfaced by a fetch or write
 * operation. Passed to {@link applyRuntimeFailure} to decide whether
 * to re-throw or transition to `effective_mode=github_token`.
 *
 * @public
 */
export type RuntimeFailure = {
	/** Where the failure occurred ("star_fetch", "repo_write"). */
	role: "star_fetch" | "repo_write";
	/** What credential was attempted (matches selected_mode). */
	attempted: ResolvedAuth["selected_mode"];
	/** Underlying error. */
	error: Error;
};

/**
 * Ambient runtime state {@link applyRuntimeFailure} reads when
 * deciding whether a fallback transition is possible. Separated from
 * {@link RuntimeFailure} so callers supply once and reuse across many
 * failure-handling sites.
 *
 * @public
 */
export type RuntimeContext = {
	warn?: (msg: string) => void;
	/** True iff GITHUB_TOKEN is available to act as fallback target. */
	has_github_token_at_runtime: boolean;
};

/**
 * Convert a config-time ResolvedAuth into the initial EffectiveAuth.
 * No transition has fired yet, so effective_mode == selected_mode.
 */
export function startEffective(resolved: ResolvedAuth): EffectiveAuth {
	const e: EffectiveAuth = {
		...resolved,
		effective_mode: resolved.selected_mode,
		fallback_fired: false,
	};
	assertNoMixedAuth(e);
	return e;
}

/**
 * Apply a runtime failure to an EffectiveAuth and decide:
 *   - re-throw (hard fail), or
 *   - return a new EffectiveAuth with effective_mode=github_token (loud).
 *
 * The returned EffectiveAuth has every role flipped to the new mode —
 * never one-role-only.
 */
export function applyRuntimeFailure(
	current: EffectiveAuth,
	failure: RuntimeFailure,
	ctx: RuntimeContext,
): EffectiveAuth {
	// github_app: doctrine says NEVER fall back. Always hard-fail.
	if (current.selected_mode === "github_app") {
		throw failure.error;
	}

	// github_token already in effect: nothing further to fall back to.
	if (current.effective_mode === "github_token") {
		throw failure.error;
	}

	// pat mode: respect the fallback flag.
	if (current.selected_mode === "pat") {
		if (!current.pat_fallback_to_github_token) {
			throw failure.error;
		}
		if (!ctx.has_github_token_at_runtime) {
			throw failure.error;
		}
		ctx.warn?.(
			`pat-mode runtime failure on role=${failure.role} ` +
				`(attempted=${failure.attempted}). pat_fallback_to_github_token=true ` +
				`and GITHUB_TOKEN available; transitioning effective_mode to github_token. ` +
				`Subsequent roles will use GITHUB_TOKEN identity.`,
		);
		const next: EffectiveAuth = {
			...current,
			effective_mode: "github_token",
			star_fetch_auth: "github_token",
			repo_write_auth: "github_token",
			degraded: true,
			reason: `${current.reason} | runtime fallback: pat -> github_token (${failure.role})`,
			fallback_fired: true,
		};
		assertNoMixedAuth(next);
		return next;
	}

	// Should be unreachable, but defensive.
	throw failure.error;
}
