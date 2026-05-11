// CLI: invoked by .github/workflows/01-fetch-stars.yml as the fetch step.
//
// Reads env via the typed catalog (GhStarsEnv); writes step outputs
// via the dual-write helper (no node:fs / process.env reads here).
//
// Pipeline phases run under listr2's `simple` renderer — keeps the
// CI log shape one-line-per-step (stdout) while letting tasks
// stream their own progress to stderr.

import { Listr } from "listr2";
import { setOutput } from "../cli/dual-write.js";
import { GhStarsEnv } from "../contracts/env.js";
import { getGhStarsPath } from "../contracts/paths.js";
import {
	dirnameOf,
	exit,
	fileSizeBytesSync,
	getEnv,
	makeDirSync,
	onSignal,
	pathExistsSync,
	readTextFileSync,
	writeStderrLine,
	writeTextFileAtomicSync,
} from "../host-io/index.js";
import {
	createLogger,
	registerTelemetry,
	shutdownTelemetry,
} from "../telemetry/index.js";
import { fetchStars } from "./fetch-stars.js";
import { DEFAULT_METADATA_BATCH_SIZE } from "./metadata-batcher.js";
import { createOctokit } from "./octokit-client.js";
import type { FetchOutcome } from "./types.js";

function envOrDefault(key: string, dflt: string): string {
	const v = getEnv(key);
	return v?.trim() ? v.trim() : dflt;
}

interface PipelineContext {
	token: string;
	selectedMode: "github_app" | "pat" | "github_token";
	starSourceUser: string;
	listQuery: string;
	metadataFragment: string;
	resumeCursor: string | null;
	batchSize: number;
	outputFile: string;
	result?: FetchOutcome;
	outputBytes?: number;
}

async function main(): Promise<void> {
	registerTelemetry({ serviceName: "github-stars-fetch" });
	onSignal("SIGTERM", () => {
		void shutdownTelemetry();
	});
	onSignal("SIGINT", () => {
		void shutdownTelemetry();
	});
	const tlog = createLogger("fetch");
	tlog.info("fetch cli starting");

	const log = (m: string) => writeStderrLine(m);
	const warn = (m: string) => writeStderrLine(`::warning::${m}`);

	const tasks = new Listr<PipelineContext, "simple">(
		[
			{
				title: "Resolve credentials and config",
				task: (ctx) => {
					// GH_TOKEN is the workflow-issued token (App installation, PAT,
					// or GITHUB_TOKEN — the doctor decided which). Not in our
					// catalog by name because it's a per-step secret reference
					// scoped to the workflow's `env:` block, not a kernel-wide var.
					const token = getEnv("GH_TOKEN");
					if (!token) {
						throw new Error("GH_TOKEN env required for src/fetch/cli.ts");
					}
					ctx.token = token;

					const selectedModeRaw = (getEnv("SELECTED_MODE") ?? "").trim();
					if (
						!["github_app", "pat", "github_token"].includes(selectedModeRaw)
					) {
						throw new Error(
							`SELECTED_MODE must be one of: github_app, pat, github_token. ` +
								`Got: '${selectedModeRaw}'. Forward from setup-doctor.outputs.selected_mode.`,
						);
					}
					ctx.selectedMode = selectedModeRaw as
						| "github_app"
						| "pat"
						| "github_token";

					ctx.starSourceUser = (getEnv(GhStarsEnv.starSourceUser) ?? "").trim();
					if (ctx.selectedMode === "github_app" && !ctx.starSourceUser) {
						throw new Error(
							"STAR_SOURCE_USER env required when SELECTED_MODE=github_app " +
								"(REST /users/{username}/starred path needs a username; installation tokens have no user context).",
						);
					}

					ctx.outputFile = envOrDefault(
						"OUTPUT_FILE",
						getGhStarsPath("fetchedStarsGraphql"),
					);
					ctx.batchSize = parseInt(
						envOrDefault(
							"METADATA_BATCH_SIZE",
							String(DEFAULT_METADATA_BATCH_SIZE),
						),
						10,
					);
					ctx.resumeCursor = (getEnv("RESUME_CURSOR") ?? "").trim() || null;
				},
			},
			{
				title: "Load GraphQL queries from disk",
				task: (ctx) => {
					const FRAGMENT_PATH = envOrDefault(
						"METADATA_FRAGMENT_PATH",
						getGhStarsPath("starsMetadataFragment"),
					);
					if (!pathExistsSync(FRAGMENT_PATH)) {
						throw new Error(`Required query file not found: ${FRAGMENT_PATH}`);
					}
					ctx.metadataFragment = readTextFileSync(FRAGMENT_PATH);

					ctx.listQuery = "";
					if (ctx.selectedMode !== "github_app") {
						const LIST_QUERY_PATH = envOrDefault(
							"LIST_QUERY_PATH",
							getGhStarsPath("starsListQuery"),
						);
						if (!pathExistsSync(LIST_QUERY_PATH)) {
							throw new Error(
								`Required query file not found: ${LIST_QUERY_PATH}`,
							);
						}
						ctx.listQuery = readTextFileSync(LIST_QUERY_PATH);
					}
				},
			},
			{
				title: "Fetch stars (paginate + metadata batches)",
				task: async (ctx) => {
					const octokit = createOctokit({ token: ctx.token, retries: 5 });
					ctx.result = await fetchStars({
						octokit,
						selectedMode: ctx.selectedMode,
						starSourceUser: ctx.starSourceUser,
						listQuery: ctx.listQuery,
						metadataFragment: ctx.metadataFragment,
						resumeCursor: ctx.resumeCursor,
						batchSize: ctx.batchSize,
						log,
						warn,
					});
				},
			},
			{
				title: "Write output + step outputs",
				task: (ctx) => {
					if (!ctx.result) throw new Error("fetch stage produced no result");
					const result = ctx.result;
					makeDirSync(dirnameOf(ctx.outputFile), { recursive: true });
					writeTextFileAtomicSync(
						ctx.outputFile,
						JSON.stringify(result.repos, null, 2),
					);
					ctx.outputBytes = fileSizeBytesSync(ctx.outputFile);

					const archived = result.repos.filter((r) => r.archived).length;
					const forks = result.repos.filter((r) => r.fork).length;
					const noDesc = result.repos.filter((r) => !r.description).length;

					log(
						`Total: ${result.repos.length} repositories — list pages=${result.pageCount} metadata batches=${result.batchCount}`,
					);
					log(
						`Archived: ${archived}, Forks: ${forks}, No description: ${noDesc}`,
					);

					setOutput(`total_repos=${result.repos.length}`);
					setOutput(`archived_count=${archived}`);
					setOutput(`fork_count=${forks}`);
					setOutput(`no_description_count=${noDesc}`);
					setOutput(`output_file=${ctx.outputFile}`);
					setOutput(`output_bytes=${ctx.outputBytes}`);
					setOutput(`partial_failure_reason=${result.partialFailureReason}`);
					setOutput(`pages_fetched=${result.pageCount}`);
					setOutput(`batches_fetched=${result.batchCount}`);
					setOutput(`resume_cursor=${result.lastEndCursor ?? ""}`);
					setOutput(`blocked_orgs_count=${result.blockedOrgsCount}`);
				},
			},
		],
		{
			// `simple` renderer prints one line per task as it completes —
			// matches the github-actions log shape (no overwrites, no
			// ANSI screen control). Same renderer in TTY and non-TTY so
			// the local + CI views agree.
			renderer: "simple",
			exitOnError: true,
		},
	);

	const ctx = await tasks.run();

	if (ctx.result?.partialFailureReason) {
		writeStderrLine(
			`::error::Star fetch incomplete: ${ctx.result.partialFailureReason}. ` +
				`Wrote ${ctx.result.repos.length} partial repos to ${ctx.outputFile} ` +
				`(${ctx.outputBytes ?? 0} bytes). ` +
				`To resume, dispatch with input resume_cursor='${ctx.result.lastEndCursor ?? ""}'.`,
		);
		exit(1);
	}
}

main().catch((err: unknown) => {
	const stack = err instanceof Error ? (err.stack ?? err.message) : String(err);
	writeStderrLine(`fetch-stars cli crashed: ${stack}`);
	exit(1);
});
