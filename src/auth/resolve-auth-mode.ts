// Strict 3-mode resolver. No credential mixing. Per session-oracle verdict.
//
// Auto priority (presence of credentials only — no capability tests here;
// runtime is where capability is proven):
//   1. github_app  — both GH_APP_CLIENT_ID and GH_APP_PRIVATE_KEY present
//   2. pat         — STARS_TOKEN present
//   3. github_token — GITHUB_TOKEN present (always degraded; always loud)
//
// When the user explicitly requests a mode, only that mode is considered.
// Missing config => `disabled`-ish reason via missing_config + a thrown
// error from the workflow when auth_mode cannot be picked.
//
// Behavior on runtime failure (NOT decided here — decided by the runtime
// fallback layer in runtime-state.ts):
//   - github_app fails  -> hard fail. ALWAYS. No fallback. Ever.
//   - pat fails         -> if pat_fallback_to_github_token (default true),
//                          loud transition to effective_mode=github_token;
//                          else hard fail.
//   - github_token fails -> hard fail.

import {
	type AuthMode,
	type AuthResolverInputs,
	assertNoMixedAuth,
	type ResolvedAuth,
} from "./auth-mode.js";

export class AuthConfigError extends Error {
	constructor(
		message: string,
		readonly missing_config: string[],
	) {
		super(message);
		this.name = "AuthConfigError";
	}
}

export function resolveAuthMode(inputs: AuthResolverInputs): ResolvedAuth {
	const requested = inputs.requested_mode || "auto";
	// Default true: PAT-mode runs prefer to keep going under github_token
	// if the PAT is broken (better degraded-but-running than not running).
	// The user can set it false to make PAT failure a hard stop.
	const pat_fallback = inputs.pat_fallback_to_github_token !== false;

	if (requested !== "auto") {
		return resolveExplicit(requested, inputs, pat_fallback);
	}

	// Auto: highest-ranked mode whose REQUIRED credentials are present
	// AND which can actually serve every role end-to-end.
	//
	// Special case for github_app: until the App-based star fetch path
	// is wired up (see `github_app_supports_fetch` flag in auth-mode.ts),
	// AUTO must skip github_app even when its credentials are present.
	// Otherwise the daily cron hard-fails at fetch time because the App
	// installation token cannot read viewer.starredRepositories. EXPLICIT
	// `auth_mode: github_app` still selects the App and is allowed to
	// hard-fail per doctrine — but auto will never pick a mode it knows
	// cannot complete.
	if (
		inputs.has_gh_app_client_id &&
		inputs.has_gh_app_private_key &&
		inputs.github_app_supports_fetch === true
	) {
		return build(
			"github_app",
			inputs,
			pat_fallback,
			"auto: GitHub App credentials present and github_app_supports_fetch=true",
		);
	}
	if (inputs.has_stars_token) {
		const reason =
			inputs.has_gh_app_client_id && inputs.has_gh_app_private_key
				? "auto: STARS_TOKEN present; GitHub App configured but github_app_supports_fetch=false (App-fetch path not yet implemented)"
				: "auto: STARS_TOKEN present, GitHub App not configured";
		return build("pat", inputs, pat_fallback, reason);
	}
	if (inputs.has_github_token) {
		return build(
			"github_token",
			inputs,
			pat_fallback,
			"auto: only GITHUB_TOKEN available — degraded mode",
		);
	}

	// Nothing usable.
	throw new AuthConfigError(
		"No usable auth credentials. Need at least one of: " +
			"GH_APP_CLIENT_ID + GH_APP_PRIVATE_KEY, STARS_TOKEN, or GITHUB_TOKEN.",
		["GH_APP_CLIENT_ID|STARS_TOKEN|GITHUB_TOKEN"],
	);
}

function resolveExplicit(
	mode: AuthMode,
	inputs: AuthResolverInputs,
	pat_fallback: boolean,
): ResolvedAuth {
	switch (mode) {
		case "github_app": {
			const missing: string[] = [];
			if (!inputs.has_gh_app_client_id) missing.push("GH_APP_CLIENT_ID");
			if (!inputs.has_gh_app_private_key) missing.push("GH_APP_PRIVATE_KEY");
			if (missing.length) {
				throw new AuthConfigError(
					`Explicit github_app requested but missing: ${missing.join(", ")}`,
					missing,
				);
			}
			return build("github_app", inputs, pat_fallback, "explicit: github_app");
		}
		case "pat": {
			if (!inputs.has_stars_token) {
				throw new AuthConfigError(
					"Explicit pat requested but STARS_TOKEN missing",
					["STARS_TOKEN"],
				);
			}
			return build("pat", inputs, pat_fallback, "explicit: pat");
		}
		case "github_token": {
			if (!inputs.has_github_token) {
				throw new AuthConfigError(
					"Explicit github_token requested but GITHUB_TOKEN missing",
					["GITHUB_TOKEN"],
				);
			}
			return build(
				"github_token",
				inputs,
				pat_fallback,
				"explicit: github_token (degraded)",
			);
		}
	}
}

function build(
	selected: AuthMode,
	inputs: AuthResolverInputs,
	pat_fallback: boolean,
	reason: string,
): ResolvedAuth {
	// CORE INVARIANT: every role is the selected_mode's credential class.
	// No mixing is possible by construction. assertNoMixedAuth confirms.
	const r: ResolvedAuth = {
		requested_mode: inputs.requested_mode || "auto",
		selected_mode: selected,
		star_fetch_auth: selected,
		repo_write_auth: selected,
		star_source_user: (inputs.star_source_user || "").trim(),
		pat_fallback_to_github_token: selected === "pat" ? pat_fallback : false,
		degraded: selected === "github_token",
		reason,
		missing_config: [],
	};
	assertNoMixedAuth(r);
	return r;
}
