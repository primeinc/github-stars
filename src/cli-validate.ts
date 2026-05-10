#!/usr/bin/env bun
/**
 * CLI tool to validate repos.yml against taxonomy
 */

import { getGhStarsPath } from "./contracts/paths.js";
import { loadManifest } from "./manifest/loader.js";
import {
	formatValidationErrors,
	validateManifest,
} from "./manifest/validator.js";

const args = process.argv.slice(2);
const inputFile = args[0] || getGhStarsPath("reposManifest");

console.log("=".repeat(80));
console.log("VALIDATE MANIFEST");
console.log("=".repeat(80));
console.log();

try {
	console.log(`Loading: ${inputFile}`);
	const manifest = loadManifest(inputFile);
	console.log(
		`✓ Loaded manifest with ${manifest.repositories.length} repositories`,
	);
	console.log();

	console.log("Validating against taxonomy (strict mode)...");
	const result = validateManifest(manifest);

	console.log();
	console.log(formatValidationErrors(result));
	console.log();

	if (result.valid) {
		console.log("=".repeat(80));
		console.log("✅ VALIDATION PASSED");
		console.log("=".repeat(80));
		process.exit(0);
	} else {
		console.log("=".repeat(80));
		console.log(`❌ VALIDATION FAILED: ${result.errors.length} errors`);
		console.log("=".repeat(80));
		process.exit(1);
	}
} catch (error) {
	console.error("❌ ERROR:", error instanceof Error ? error.message : error);
	process.exit(1);
}
