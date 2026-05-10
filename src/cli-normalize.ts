#!/usr/bin/env bun
/**
 * CLI tool to normalize repos.yml in place.
 *
 * Argument parsing via commander; presentation via picocolors. Both
 * are scoped to this file's wire-format role per the eslint
 * `src/cli-*.ts` carve-out (see eslint.config.ts L621-L639).
 */

import { Command } from "commander";
import pc from "picocolors";
import { getGhStarsPath } from "./contracts/paths.js";
import { exit, onSignal, processArgv } from "./host-io/index.js";
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

const program = new Command();
program
	.name("normalize")
	.description(
		"Normalize repos.yml in place: canonicalises taxonomy aliases, " +
			"casing, and tag forms before any downstream gate runs.",
	)
	.argument("[input]", "manifest path (default: repos.yml)")
	.option("-c, --check", "dry-run: report what would change, write nothing")
	.option("--dry-run", "alias for --check")
	.parse(processArgv() as string[]);

const inputFile: string = program.args[0] ?? getGhStarsPath("reposManifest");
const opts = program.opts<{ check?: boolean; dryRun?: boolean }>();
const checkMode = Boolean(opts.check ?? opts.dryRun);

const bar = pc.dim("=".repeat(80));
console.log(bar);
console.log(
	pc.bold(`NORMALIZE MANIFEST${checkMode ? pc.yellow(" (DRY RUN)") : ""}`),
);
console.log(bar);
console.log();

try {
	console.log(`Loading: ${inputFile}`);
	const manifest = loadManifest(inputFile);
	console.log(
		pc.green("✓") +
			` Loaded manifest with ${manifest.repositories.length} repositories`,
	);
	console.log();

	console.log("Normalizing...");
	const result = normalizeManifest(manifest);

	console.log(`${pc.green("✓")} Normalization complete`);
	console.log();
	console.log(pc.bold("SUMMARY:"));
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
		console.log(
			`${pc.cyan("ℹ")}  Running in check mode - no files will be modified`,
		);
		if (result.summary.modifiedRepos > 0) {
			console.log(`${pc.red("✗")} Manifest needs normalization`);
			exit(1);
		} else {
			console.log(`${pc.green("✓")} Manifest is already normalized`);
			exit(0);
		}
	}

	// Validate normalized manifest before writing
	console.log("Validating normalized manifest...");
	const validation = validateManifest(result.manifest);

	if (!validation.valid) {
		console.error(
			`${pc.red("✗")} Normalized manifest still has validation errors:`,
		);
		console.error(formatValidationErrors(validation));
		exit(1);
	}

	console.log(`${pc.green("✓")} Validation passed`);
	console.log();

	// Write normalized manifest
	console.log(`Writing to: ${inputFile}`);
	writeManifest(result.manifest, inputFile);
	console.log(`${pc.green("✓")} Manifest written successfully`);
	console.log();

	console.log(bar);
	console.log(pc.green(pc.bold("✓ NORMALIZATION COMPLETE")));
	console.log(bar);
} catch (error) {
	console.error(
		`${pc.red("✗")} ERROR:`,
		error instanceof Error ? error.message : error,
	);
	exit(1);
}
