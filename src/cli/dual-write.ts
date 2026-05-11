// Dual-write helper for GitHub Actions step outputs and step
// summaries. Every CLI that runs in a workflow step needs to:
//
//   1. Push key=value lines to `$GITHUB_OUTPUT` (consumed by
//      `${{ steps.<id>.outputs.<key> }}` in the workflow YAML).
//   2. Push markdown to `$GITHUB_STEP_SUMMARY` (rendered as the
//      job's collapsible summary panel).
//
// Both env vars resolve to file paths the runner created; absent vars
// (local dev, non-Actions environments) make the helpers no-op
// silently — that's the contract the GitHub Actions docs codify
// (refs/github/docs/.../workflow-commands-for-github-actions.md).
//
// Three previous call sites duplicated this shape: src/fetch/cli.ts,
// src/sync/cli.ts, src/auth/setup-doctor.ts. They now route through
// here so a doc-shape change (e.g. a new `\n` requirement) lands in
// one file.

import { GhStarsEnv } from "../contracts/env.js";
import { appendFileTextSync, getEnv } from "../host-io/index.js";

/**
 * Append one `key=value` line to the workflow's `GITHUB_OUTPUT` file
 * so a downstream step can consume `${{ steps.<id>.outputs.<key> }}`.
 *
 * Silent no-op when `GITHUB_OUTPUT` is unset (local dev). The caller
 * supplies the bare `key=value` text — no surrounding whitespace or
 * trailing newline.
 *
 * @public
 */
export function setOutput(line: string): void {
	const out = getEnv(GhStarsEnv.githubOutput);
	if (out === undefined || out === "") return;
	appendFileTextSync(out, `${line}\n`);
}

/**
 * Append a block of markdown to the workflow's
 * `GITHUB_STEP_SUMMARY` file. Adds exactly one trailing newline so
 * successive blocks separate cleanly under GitHub's renderer.
 *
 * Silent no-op when `GITHUB_STEP_SUMMARY` is unset.
 *
 * @public
 */
export function appendStepSummary(markdown: string): void {
	const summary = getEnv(GhStarsEnv.githubStepSummary);
	if (summary === undefined || summary === "") return;
	appendFileTextSync(summary, `${markdown}\n`);
}
