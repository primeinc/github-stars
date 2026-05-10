#!/usr/bin/env tsx
/**
 * Executable repro script for taxonomy enforcement
 * Demonstrates fail->pass behavior with invalid manifest
 */

import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { loadManifest } from "./manifest/loader.js";
import { normalizeManifest } from "./manifest/normalizer.js";
import {
	formatValidationErrors,
	validateManifest,
} from "./manifest/validator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureFile = path.join(__dirname, "../fixtures/repos.invalid.yml");

console.log("=".repeat(80));
console.log("TAXONOMY ENFORCEMENT REPRODUCTION");
console.log("=".repeat(80));
console.log();

// Phase 1: BEFORE - Strict validation should fail
console.log("📋 PHASE 1: BEFORE NORMALIZATION");
console.log("-".repeat(80));

try {
	console.log(`Loading fixture: ${fixtureFile}`);
	const manifest = loadManifest(fixtureFile);
	console.log(
		`✓ Loaded manifest with ${manifest.repositories.length} repositories`,
	);
	console.log();

	console.log("Validating against taxonomy (strict mode)...");
	const validationBefore = validateManifest(manifest);

	console.log();
	console.log(formatValidationErrors(validationBefore));
	console.log();

	if (!validationBefore.valid) {
		console.log(
			`❌ Validation FAILED with ${validationBefore.errors.length} errors`,
		);
		console.log("   This is EXPECTED - the fixture contains invalid data");
	} else {
		console.log("⚠️  WARNING: Validation passed but should have failed!");
		process.exit(1);
	}

	console.log();
	console.log("=".repeat(80));
	console.log();

	// Phase 2: AFTER - Normalize and validate should pass
	console.log("📋 PHASE 2: AFTER NORMALIZATION");
	console.log("-".repeat(80));

	console.log("Normalizing manifest...");
	const result = normalizeManifest(manifest);

	console.log();
	console.log("✓ Normalization complete");
	console.log();
	console.log("SUMMARY:");
	console.log(`  Total repos:      ${result.summary.totalRepos}`);
	console.log(`  Modified repos:   ${result.summary.modifiedRepos}`);
	console.log(`  Needs review:     ${result.summary.needsReviewCount}`);
	console.log();

	// Show first 10 changes
	if (result.changedRepos.length > 0) {
		console.log("CHANGES (first 10):");
		const toShow = result.changedRepos.slice(0, 10);
		for (const { repo, changes } of toShow) {
			console.log(`  ${repo}:`);
			for (const change of changes) {
				console.log(`    - ${change}`);
			}
		}
		if (result.changedRepos.length > 10) {
			console.log(`  ... and ${result.changedRepos.length - 10} more`);
		}
		console.log();
	}

	console.log("Validating normalized manifest (strict mode)...");
	const validationAfter = validateManifest(result.manifest);

	console.log();
	console.log(formatValidationErrors(validationAfter));
	console.log();

	if (validationAfter.valid) {
		console.log("✅ Validation PASSED after normalization");
	} else {
		console.log(
			`❌ Validation still FAILED with ${validationAfter.errors.length} errors`,
		);
		process.exit(1);
	}

	console.log();
	console.log("=".repeat(80));
	console.log("✅ REPRODUCTION SUCCESSFUL: fail → pass behavior demonstrated");
	console.log("=".repeat(80));

	process.exit(0);
} catch (error) {
	console.error("❌ ERROR:", error instanceof Error ? error.message : error);
	process.exit(1);
}
