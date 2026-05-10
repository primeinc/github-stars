#!/usr/bin/env bun
/**
 * CLI tool to validate repos.yml against taxonomy.
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
import {
	formatValidationErrors,
	validateManifest,
} from "./manifest/validator.js";
import {
	createLogger,
	registerTelemetry,
	shutdownTelemetry,
} from "./telemetry/index.js";

registerTelemetry({ serviceName: "github-stars-validate" });
onSignal("SIGTERM", () => {
	void shutdownTelemetry();
});
onSignal("SIGINT", () => {
	void shutdownTelemetry();
});
const tlog = createLogger("validate");
tlog.info("validate cli starting");

const program = new Command();
program
	.name("validate")
	.description(
		"Validate repos.yml against the taxonomy in src/manifest/taxonomy.ts " +
			"in strict mode. Hard-fails on any unknown category, framework, or " +
			"tag.",
	)
	.argument("[input]", "manifest path (default: repos.yml)")
	.parse(processArgv() as string[]);

const inputFile: string = program.args[0] ?? getGhStarsPath("reposManifest");

const bar = pc.dim("=".repeat(80));
console.log(bar);
console.log(pc.bold("VALIDATE MANIFEST"));
console.log(bar);
console.log();

try {
	console.log(`Loading: ${inputFile}`);
	const manifest = loadManifest(inputFile);
	console.log(
		`${pc.green("✓")} Loaded manifest with ${manifest.repositories.length} repositories`,
	);
	console.log();

	console.log("Validating against taxonomy (strict mode)...");
	const result = validateManifest(manifest);

	console.log();
	console.log(formatValidationErrors(result));
	console.log();

	if (result.valid) {
		console.log(bar);
		console.log(pc.green(pc.bold("✓ VALIDATION PASSED")));
		console.log(bar);
		exit(0);
	} else {
		console.log(bar);
		console.log(
			pc.red(pc.bold(`✗ VALIDATION FAILED: ${result.errors.length} errors`)),
		);
		console.log(bar);
		exit(1);
	}
} catch (error) {
	console.error(
		`${pc.red("✗")} ERROR:`,
		error instanceof Error ? error.message : error,
	);
	exit(1);
}
