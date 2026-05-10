// Construct an Octokit client matching the workflow's prior posture:
//   - retry plugin enabled (retries: 5)
//   - request log plugin enabled (visible attempts in CI)
//
// Verified plugin behavior (refs/octokit/plugin-retry.js/src/wrap-request.ts
// L37-62): the retry plugin intercepts both real HTTP 5xx and the GraphQL
// "Something went wrong while executing your query" envelope (HTTP 200
// with errors[]) and converts the latter into a synthesized 500 so the
// bottleneck retry path triggers. Honors Retry-After.

import { Octokit } from "@octokit/core";
import { requestLog } from "@octokit/plugin-request-log";
import { retry } from "@octokit/plugin-retry";

const RetryingOctokit = Octokit.plugin(retry, requestLog);

export type OctokitClient = InstanceType<typeof RetryingOctokit>;

export type ClientOptions = {
	token: string;
	/** Default 5; matches the prior workflow setting. */
	retries?: number;
	userAgent?: string;
};

export function createOctokit(opts: ClientOptions): OctokitClient {
	return new RetryingOctokit({
		auth: opts.token,
		userAgent: opts.userAgent ?? "github-stars-control-plane",
		request: { retries: opts.retries ?? 5 },
	});
}
