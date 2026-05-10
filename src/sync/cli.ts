// CLI: invoked by .github/workflows/02-sync-stars.yml as the sync step.

import { setOutput } from "../cli/dual-write.js";
import { getGhStarsPath } from "../contracts/paths.js";
import type { FetchedRepo } from "../fetch/types.js";
import {
	exit,
	getEnv,
	onSignal,
	readTextFileSync,
	writeStderrLine,
} from "../host-io/index.js";
import {
	assertNoPrivateLeak,
	PRIVATE_SENTINEL_SLUG,
	quarantinePrivate,
} from "../privacy/index.js";
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

	// Privacy quarantine — defense in depth per #74. The fetch path
	// drops `private:true` records before they reach the manifest; this
	// is the downstream tripwire in case schema drift, hand-edits, or
	// a future code path lets one slip through. github-stars deploys
	// from a public repo so visibility is `public` here.
	const quarantined = quarantinePrivate({
		visibility: "public",
		batch: result.manifest.repositories,
	});
	if (quarantined.omittedCount > 0) {
		writeStderrLine(
			`::warning::Privacy quarantine removed ${quarantined.omittedCount} private repo record(s) from the post-reconcile manifest. Names redacted from public log per session-oracle verdict rule 8.`,
		);
		setOutput(`private_repos_quarantined=${quarantined.omittedCount}`);
	}
	const sanitizedManifest = {
		...result.manifest,
		repositories: [...quarantined.kept],
	};

	if (result.stats.changed) {
		writeManifest(MANIFEST_PATH, sanitizedManifest);
		writeStderrLine(
			`Wrote ${MANIFEST_PATH}: ${result.stats.total_new} new, ${result.stats.total_removed} removed, ${result.stats.total_updated} updated → ${result.stats.total_repos} total`,
		);
		// Sentinel tripwire — re-read what we just wrote and assert the
		// known-private fixture slug is not present. If it is, the
		// pipeline aborts before the workflow's commit step runs.
		const written = readTextFileSync(MANIFEST_PATH);
		assertNoPrivateLeak(written, [PRIVATE_SENTINEL_SLUG], MANIFEST_PATH);
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
