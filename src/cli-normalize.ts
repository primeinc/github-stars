#!/usr/bin/env bun
/**
 * CLI tool to normalize repos.yml in place
 */

import { getGhStarsPath } from "./contracts/paths.js";
import { onSignal } from "./host-io/index.js";
import { loadManifest } from "./manifest/loader.js";
import { normalizeManifest } from "./manifest/normalizer.js";
import {
	formatValidationErrors,
	validateManifest,
} from "./manifest/validator.js";
import { writeManifest } from "./manifest/writer.js";
import {
	createLogger,
	registerTelemetry,
	shutdownTelemetry,
} from "./telemetry/index.js";

registerTelemetry({ serviceName: "github-stars-normalize" });
onSignal("SIGTERM", () => {
	void shutdownTelemetry();
});
onSignal("SIGINT", () => {
	void shutdownTelemetry();
});
const tlog = createLogger("normalize");
tlog.info("normalize cli starting");

const args = process.argv.slice(2);
const inputFile = args[0] || getGhStarsPath("reposManifest");
const checkMode = args.includes("--check") || args.includes("--dry-run");

console.log("=".repeat(80));
console.log(`NORMALIZE MANIFEST${checkMode ? " (DRY RUN)" : ""}`);
console.log("=".repeat(80));
console.log();

try {
	console.log(`Loading: ${inputFile}`);
	const manifest = loadManifest(inputFile);
	console.log(
		`✓ Loaded manifest with ${manifest.repositories.length} repositories`,
	);
	console.log();

	console.log("Normalizing...");
	const result = normalizeManifest(manifest);

	console.log("✓ Normalization complete");
	console.log();
	console.log("SUMMARY:");
	console.log(`  Total repos:      ${result.summary.totalRepos}`);
	console.log(`  Modified repos:   ${result.summary.modifiedRepos}`);
	console.log(`  Needs review:     ${result.summary.needsReviewCount}`);
	console.log();

	if (result.changedRepos.length > 0) {
		const maxToShow = 50;
		console.log(`CHANGES (first ${maxToShow}):`);
		const toShow = result.changedRepos.slice(0, maxToShow);
		for (const { repo, changes } of toShow) {
			console.log(`  ${repo}:`);
			for (const change of changes) {
				console.log(`    - ${change}`);
			}
		}
		if (result.changedRepos.length > maxToShow) {
			console.log(`  ... and ${result.changedRepos.length - maxToShow} more`);
		}
		console.log();
	} else {
		console.log("No changes needed - manifest is already normalized.");
		console.log();
	}

	if (checkMode) {
		console.log("ℹ️  Running in check mode - no files will be modified");
		if (result.summary.modifiedRepos > 0) {
			console.log("❌ Manifest needs normalization");
			process.exit(1);
		} else {
			console.log("✅ Manifest is already normalized");
			process.exit(0);
		}
	}

	// Validate normalized manifest before writing
	console.log("Validating normalized manifest...");
	const validation = validateManifest(result.manifest);

	if (!validation.valid) {
		console.error("❌ Normalized manifest still has validation errors:");
		console.error(formatValidationErrors(validation));
		process.exit(1);
	}

	console.log("✓ Validation passed");
	console.log();

	// Write normalized manifest
	console.log(`Writing to: ${inputFile}`);
	writeManifest(result.manifest, inputFile);
	console.log("✓ Manifest written successfully");
	console.log();

	console.log("=".repeat(80));
	console.log("✅ NORMALIZATION COMPLETE");
	console.log("=".repeat(80));
} catch (error) {
	console.error("❌ ERROR:", error instanceof Error ? error.message : error);
	process.exit(1);
}
