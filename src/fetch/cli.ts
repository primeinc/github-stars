// CLI: invoked by .github/workflows/01-fetch-stars.yml as the fetch step.
//
// Reads env via the typed catalog (GhStarsEnv); writes outputs via
// host-io's appendFileTextSync (no node:fs / process.env reads here).

import { GhStarsEnv } from "../contracts/env.js";
import { getGhStarsPath } from "../contracts/paths.js";
import {
	appendFileTextSync,
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

function envOrDefault(key: string, dflt: string): string {
	const v = getEnv(key);
	return v?.trim() ? v.trim() : dflt;
}

function setOutput(line: string): void {
	const out = getEnv(GhStarsEnv.githubOutput);
	if (!out) return;
	appendFileTextSync(out, `${line}\n`);
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

	// GH_TOKEN is the workflow-issued token (App installation, PAT, or
	// GITHUB_TOKEN — the doctor decided which). Not in our catalog by
	// name because it's a per-step secret reference scoped to the
	// workflow's `env:` block, not a kernel-wide var.
	const token = getEnv("GH_TOKEN");
	if (!token) {
		writeStderrLine("GH_TOKEN env required for src/fetch/cli.ts");
		exit(2);
	}

	const selectedModeRaw = (getEnv("SELECTED_MODE") ?? "").trim();
	if (!["github_app", "pat", "github_token"].includes(selectedModeRaw)) {
		writeStderrLine(
			`SELECTED_MODE must be one of: github_app, pat, github_token. ` +
				`Got: '${selectedModeRaw}'. Forward from setup-doctor.outputs.selected_mode.`,
		);
		exit(2);
	}
	const selectedMode = selectedModeRaw as "github_app" | "pat" | "github_token";

	const starSourceUser = (getEnv(GhStarsEnv.starSourceUser) ?? "").trim();
	if (selectedMode === "github_app" && !starSourceUser) {
		writeStderrLine(
			"STAR_SOURCE_USER env required when SELECTED_MODE=github_app " +
				"(REST /users/{username}/starred path needs a username; installation tokens have no user context).",
		);
		exit(2);
	}

	const LIST_QUERY_PATH = envOrDefault(
		"LIST_QUERY_PATH",
		getGhStarsPath("starsListQuery"),
	);
	const FRAGMENT_PATH = envOrDefault(
		"METADATA_FRAGMENT_PATH",
		getGhStarsPath("starsMetadataFragment"),
	);
	const OUTPUT_FILE = envOrDefault(
		"OUTPUT_FILE",
		getGhStarsPath("fetchedStarsGraphql"),
	);
	const BATCH_SIZE = parseInt(
		envOrDefault("METADATA_BATCH_SIZE", String(DEFAULT_METADATA_BATCH_SIZE)),
		10,
	);
	const resumeCursor = (getEnv("RESUME_CURSOR") ?? "").trim() || null;

	if (!pathExistsSync(FRAGMENT_PATH)) {
		writeStderrLine(`Required query file not found: ${FRAGMENT_PATH}`);
		exit(2);
	}
	let listQuery = "";
	if (selectedMode !== "github_app") {
		if (!pathExistsSync(LIST_QUERY_PATH)) {
			writeStderrLine(`Required query file not found: ${LIST_QUERY_PATH}`);
			exit(2);
		}
		listQuery = readTextFileSync(LIST_QUERY_PATH);
	}
	const metadataFragment = readTextFileSync(FRAGMENT_PATH);

	const octokit = createOctokit({ token, retries: 5 });

	const log = (m: string) => writeStderrLine(m);
	const warn = (m: string) => writeStderrLine(`::warning::${m}`);

	const result = await fetchStars({
		octokit,
		selectedMode,
		starSourceUser,
		listQuery,
		metadataFragment,
		resumeCursor,
		batchSize: BATCH_SIZE,
		log,
		warn,
	});

	makeDirSync(dirnameOf(OUTPUT_FILE), { recursive: true });
	writeTextFileAtomicSync(OUTPUT_FILE, JSON.stringify(result.repos, null, 2));
	const outputBytes = fileSizeBytesSync(OUTPUT_FILE);

	const archived = result.repos.filter((r) => r.archived).length;
	const forks = result.repos.filter((r) => r.fork).length;
	const noDesc = result.repos.filter((r) => !r.description).length;

	log(
		`Total: ${result.repos.length} repositories — list pages=${result.pageCount} metadata batches=${result.batchCount}`,
	);
	log(`Archived: ${archived}, Forks: ${forks}, No description: ${noDesc}`);

	setOutput(`total_repos=${result.repos.length}`);
	setOutput(`archived_count=${archived}`);
	setOutput(`fork_count=${forks}`);
	setOutput(`no_description_count=${noDesc}`);
	setOutput(`output_file=${OUTPUT_FILE}`);
	setOutput(`output_bytes=${outputBytes}`);
	setOutput(`partial_failure_reason=${result.partialFailureReason}`);
	setOutput(`pages_fetched=${result.pageCount}`);
	setOutput(`batches_fetched=${result.batchCount}`);
	setOutput(`resume_cursor=${result.lastEndCursor ?? ""}`);
	setOutput(`blocked_orgs_count=${result.blockedOrgsCount}`);

	if (result.partialFailureReason) {
		writeStderrLine(
			`::error::Star fetch incomplete: ${result.partialFailureReason}. ` +
				`Wrote ${result.repos.length} partial repos to ${OUTPUT_FILE} (${outputBytes} bytes). ` +
				`To resume, dispatch with input resume_cursor='${result.lastEndCursor ?? ""}'.`,
		);
		exit(1);
	}
}

main().catch((err: unknown) => {
	const stack = err instanceof Error ? (err.stack ?? err.message) : String(err);
	writeStderrLine(`fetch-stars cli crashed: ${stack}`);
	exit(1);
});
