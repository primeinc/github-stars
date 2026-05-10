// CLI: invoked by .github/workflows/02-sync-stars.yml as the sync step.

import { GhStarsEnv } from "../contracts/env.js";
import { getGhStarsPath } from "../contracts/paths.js";
import type { FetchedRepo } from "../fetch/types.js";
import {
	appendFileTextSync,
	exit,
	getEnv,
	onSignal,
	readTextFileSync,
	writeStderrLine,
} from "../host-io/index.js";
import {
	createLogger,
	registerTelemetry,
	shutdownTelemetry,
} from "../telemetry/index.js";
import { loadManifest, writeManifest } from "./manifest-io.js";
import { reconcile } from "./reconcile.js";

function envOrDefault(key: string, dflt: string): string {
	const v = getEnv(key);
	return v?.trim() ? v.trim() : dflt;
}

function setOutput(line: string): void {
	const out = getEnv(GhStarsEnv.githubOutput);
	if (!out) return;
	appendFileTextSync(out, `${line}\n`);
}

function main(): void {
	registerTelemetry({ serviceName: "github-stars-sync" });
	onSignal("SIGTERM", () => {
		void shutdownTelemetry();
	});
	onSignal("SIGINT", () => {
		void shutdownTelemetry();
	});
	const tlog = createLogger("sync");
	tlog.info("sync cli starting");

	const FETCHED_STARS_PATH = envOrDefault(
		"FETCHED_STARS_PATH",
		getGhStarsPath("fetchedStarsGraphql"),
	);
	const MANIFEST_PATH = envOrDefault(
		"MANIFEST_PATH",
		getGhStarsPath("reposManifest"),
	);
	const githubUser = (getEnv("GITHUB_USER") ?? "").trim() || undefined;
	const removalOverride =
		(getEnv("MANIFEST_REMOVAL_OVERRIDE") ?? "").trim().toLowerCase() === "true";

	const fetched: FetchedRepo[] = JSON.parse(
		readTextFileSync(FETCHED_STARS_PATH),
	);
	if (!Array.isArray(fetched)) {
		writeStderrLine(
			`::error::Invalid fetched-stars data at ${FETCHED_STARS_PATH}: expected array`,
		);
		exit(2);
	}
	writeStderrLine(
		`Loaded ${fetched.length} fetched repos from ${FETCHED_STARS_PATH}`,
	);

	const manifest = loadManifest(MANIFEST_PATH);
	writeStderrLine(
		`Loaded manifest with ${manifest.repositories.length} repos from ${MANIFEST_PATH}`,
	);

	const result = reconcile({
		manifest,
		fetched,
		...(githubUser !== undefined ? { githubUser } : {}),
		removalOverride,
	});
	if (result.kind === "destructive") {
		writeStderrLine(`::error::${result.reason}`);
		setOutput("changed=false");
		setOutput("destructive_refused=true");
		setOutput(`removal_ratio=${result.stats.removal_ratio}`);
		setOutput(`total_removed=${result.stats.total_removed}`);
		setOutput(`total_repos=${result.stats.total_repos}`);
		exit(1);
	}

	if (result.stats.changed) {
		writeManifest(MANIFEST_PATH, result.manifest);
		writeStderrLine(
			`Wrote ${MANIFEST_PATH}: ${result.stats.total_new} new, ${result.stats.total_removed} removed, ${result.stats.total_updated} updated → ${result.stats.total_repos} total`,
		);
	} else {
		writeStderrLine("No changes to write.");
	}

	setOutput(`changed=${result.stats.changed ? "true" : "false"}`);
	setOutput(`total_new=${result.stats.total_new}`);
	setOutput(`total_removed=${result.stats.total_removed}`);
	setOutput(`total_updated=${result.stats.total_updated}`);
	setOutput(`total_repos=${result.stats.total_repos}`);
	setOutput(`removal_ratio=${result.stats.removal_ratio}`);
	setOutput("destructive_refused=false");
}

try {
	main();
} catch (err) {
	const stack = err instanceof Error ? (err.stack ?? err.message) : String(err);
	writeStderrLine(`sync cli crashed: ${stack}`);
	exit(1);
}
