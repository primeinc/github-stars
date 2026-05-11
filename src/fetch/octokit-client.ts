// Construct an Octokit client from the workflow-issued token.
//
// We use `@octokit/rest` (which bundles paginate + the typed REST
// endpoint methods on top of `@octokit/core`) instead of bare
// @octokit/core + a fistful of plugin-* packages. Same retry behaviour
// is configured via the request.retries option built into Octokit's core
// — refs/octokit/octokit.js/README.md "Retries" — so the dropped
// `@octokit/plugin-retry` is replaced by the first-party knob.
//
// The token is whatever the workflow minted:
//   - github_app mode -> installation token (actions/create-github-app-token)
//   - pat mode        -> STARS_TOKEN
//   - github_token mode -> GITHUB_TOKEN
//
// The token type is opaque to this layer; the auth boundary lives
// upstream in src/auth/.

import { Octokit } from "@octokit/rest";

/**
 * Octokit instance type. REST endpoint methods + paginate built in via
 * `\@octokit/rest`.
 *
 * @public
 */
export type OctokitClient = Octokit;

/**
 * Options for {@link createOctokit}.
 *
 * @public
 */
export type ClientOptions = {
	token: string;
	/** Default 5; matches the prior workflow setting. */
	retries?: number;
	userAgent?: string;
};

/**
 * Construct an authenticated Octokit client. Retry/backoff is supplied
 * to `request.retries` per the Octokit core retry contract.
 *
 * @public
 */
export function createOctokit(opts: ClientOptions): OctokitClient {
	return new Octokit({
		auth: opts.token,
		userAgent: opts.userAgent ?? "github-stars-control-plane",
		request: { retries: opts.retries ?? 5 },
	});
}
