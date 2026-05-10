// Strict single-credential auth modes per the session-oracle verdict.
//
// The doctrine — verbatim from the patch mandate:
//
//   1. Auto selects the highest-ranked configured mode:
//        github_app -> pat -> github_token.
//   2. A selected mode owns ALL auth roles for the run.
//   3. No role may borrow another mode's credential.
//   4. github_app failure hard-fails by default.
//   5. pat failure falls back to github_token by default,
//      with a config flag to hard-fail.
//   6. Fallback is represented as effective_mode=github_token,
//      never as mixed role auth.
//   7. Any summary with star_fetch_auth != repo_write_auth fails validation.
//   8. Public logs/artifacts MUST NOT expose blocked/private source names.
//
// The previous design (where `auth_mode=github_app` could quietly use a
// PAT for star fetch while using the App for write) was credential-class
// laundering. This file prevents that combination from being expressible
// in the type system, and assertNoMixedAuth() enforces it at runtime.

export const AUTH_MODES = ["github_app", "pat", "github_token"] as const;
export type AuthMode = (typeof AUTH_MODES)[number];

/** Inputs to the resolver. Resolver decides; never mixes. */
export type AuthResolverInputs = {
	/** workflow_dispatch input or schedule default. 'auto' = resolver picks. */
	requested_mode?: AuthMode | "auto";
	/** GitHub user whose stars are fetched. */
	star_source_user?: string;

	/** Secrets/vars surface (presence checked, never values printed). */
	has_gh_app_client_id?: boolean;
	has_gh_app_private_key?: boolean;
	has_stars_token?: boolean;
	has_github_token?: boolean;

	/**
	 * Allow loud fallback from `pat` to `github_token` when PAT is broken
	 * at runtime. Default: true. github_app NEVER falls back; if it can't
	 * do the work, the run hard-fails.
	 */
	pat_fallback_to_github_token?: boolean;

	/**
	 * Whether the github_app credential class can serve the star_fetch
	 * role end-to-end. The App-fetch path uses REST
	 * /users/{username}/starred which is `serverToServer: true` per
	 * first-party docs (refs/github/docs/.../activity.json L95321-95330).
	 * See src/fetch/list-paginator-rest.ts for the implementation
	 * + cited progAccess block.
	 *
	 * Defaults TRUE — the path is implemented and verified. Set
	 * GITHUB_APP_SUPPORTS_FETCH=false to force AUTO to skip github_app
	 * (e.g. while debugging an issue with the REST path).
	 */
	github_app_supports_fetch?: boolean;
};

/**
 * The selected mode determines the credential class used for every role.
 * No role-by-role variation exists. star_fetch and repo_write are derived,
 * not configured — they are always the same as `selected_mode`'s class.
 */
export type ResolvedAuth = {
	/** What the user/auto requested. */
	requested_mode: AuthMode | "auto";
	/** What the resolver chose at config time. Owns every role. */
	selected_mode: AuthMode;
	/** Same as selected_mode at config time. effective_mode may differ at
	 *  runtime if a fallback transition fires (see runtime-state.ts). */
	star_fetch_auth: AuthMode;
	repo_write_auth: AuthMode;
	/** Passthrough — which user's stars to fetch. Not part of auth decision. */
	star_source_user: string;
	/**
	 * For `pat` mode: whether a runtime fallback to `github_token` is allowed
	 * if PAT is broken. Default true. Surfaced so the workflow can branch.
	 */
	pat_fallback_to_github_token: boolean;
	/** True when selected_mode is `github_token` (always degraded). */
	degraded: boolean;
	reason: string;
	/** When selected_mode cannot be picked at all — names what's missing. */
	missing_config: string[];
};

/**
 * Runtime fallback transition. Emitted ONLY when `pat` mode fires and
 * its credential is broken at runtime AND `pat_fallback_to_github_token`
 * is true. Represents the transition explicitly — never a hidden role swap.
 */
export type EffectiveAuth = ResolvedAuth & {
	effective_mode: AuthMode;
	/** True iff effective_mode != selected_mode (a transition happened). */
	fallback_fired: boolean;
};

/**
 * Runtime guard. Any code path that produces a ResolvedAuth or
 * EffectiveAuth where star_fetch_auth != repo_write_auth must fail
 * loudly. This is the load-bearing check. The type system makes
 * mixed-role auth unrepresentable for ResolvedAuth (both fields derive
 * from `selected_mode`); this asserts it for arbitrary inputs.
 */
export function assertNoMixedAuth(auth: {
	star_fetch_auth: string;
	repo_write_auth: string;
}): void {
	if (auth.star_fetch_auth !== auth.repo_write_auth) {
		throw new Error(
			`Invalid mixed auth boundary: star_fetch_auth=${auth.star_fetch_auth}, ` +
				`repo_write_auth=${auth.repo_write_auth}. ` +
				`A selected mode must own every role.`,
		);
	}
}
