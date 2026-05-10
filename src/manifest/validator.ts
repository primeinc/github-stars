/**
 * Validator module for strict validation of manifest against taxonomy
 */

import { isCategoryAllowed, isFrameworkAllowed } from "./taxonomy.js";
import type { Manifest, ValidationError, ValidationResult } from "./types.js";

/**
 * Validate all repositories in a manifest against taxonomy
 * Returns a list of errors and warnings
 */
export function validateManifest(manifest: Manifest): ValidationResult {
	const errors: ValidationError[] = [];
	const warnings: ValidationError[] = [];

	// Validate taxonomy exists
	if (
		!manifest.taxonomy ||
		!Array.isArray(manifest.taxonomy.categories_allowed)
	) {
		errors.push({
			repo: "<manifest>",
			field: "taxonomy.categories_allowed",
			value: "",
			message: "Taxonomy categories_allowed is missing or not an array",
		});
		return { valid: false, errors, warnings };
	}

	if (manifest.taxonomy.categories_allowed.length === 0) {
		errors.push({
			repo: "<manifest>",
			field: "taxonomy.categories_allowed",
			value: "",
			message: "Taxonomy categories_allowed is empty",
		});
		return { valid: false, errors, warnings };
	}

	// Validate each repository
	for (const repo of manifest.repositories) {
		// Validate categories
		if (!Array.isArray(repo.categories) || repo.categories.length === 0) {
			errors.push({
				repo: repo.repo,
				field: "categories",
				value: JSON.stringify(repo.categories),
				message: "Categories must be a non-empty array",
			});
			continue;
		}

		for (const category of repo.categories) {
			// Allow 'unclassified' as a special fallback category
			if (category === "unclassified") {
				continue;
			}

			if (!isCategoryAllowed(category, manifest.taxonomy)) {
				errors.push({
					repo: repo.repo,
					field: "categories",
					value: category,
					message: `Category "${category}" is not in taxonomy.categories_allowed`,
				});
			}
		}

		// Validate framework if present
		if (repo.framework !== undefined && repo.framework !== null) {
			if (typeof repo.framework !== "string") {
				errors.push({
					repo: repo.repo,
					field: "framework",
					value: String(repo.framework),
					message: "Framework must be a string or null",
				});
			} else if (!isFrameworkAllowed(repo.framework, manifest.taxonomy)) {
				errors.push({
					repo: repo.repo,
					field: "framework",
					value: repo.framework,
					message: `Framework "${repo.framework}" is not in taxonomy.frameworks_allowed`,
				});
			}
		}

		// Validate tag format (warning only): optional `<scope>:` prefix
		// (lowercase letters), then lowercase alphanumeric + dashes.
		// Structural check instead of regex — eslint-plugin-security
		// flags non-trivial regex literals as a precaution, and the
		// rule below is easier for new contributors to read.
		for (const tag of repo.tags || []) {
			if (!isValidTag(tag)) {
				warnings.push({
					repo: repo.repo,
					field: "tags",
					value: tag,
					message: `Tag "${tag}" doesn't match expected pattern`,
				});
			}
		}
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings,
	};
}

/**
 * Predicate for `isValidTag` — a single tag must match
 * `<scope>:?<body>` where:
 *
 *   - optional `<scope>` is one or more ASCII lowercase letters followed
 *     by a colon
 *   - `<body>` starts with `[a-z0-9]` and continues with `[a-z0-9-]*`
 *
 * @remarks
 * Equivalent to the regex `/^([a-z]+:)?[a-z0-9][a-z0-9-]*$/` but written
 * as a char-by-char walk so eslint-plugin-security's
 * `detect-unsafe-regex` rule does not flag it; same predicate, more
 * inspectable to new contributors.
 *
 * @public
 */
export function isValidTag(tag: string): boolean {
	if (typeof tag !== "string" || tag.length === 0) return false;
	let i = 0;
	// Optional `<scope>:` prefix.
	const colon = tag.indexOf(":");
	if (colon > 0) {
		for (let j = 0; j < colon; j++) {
			const c = tag.charCodeAt(j);
			if (!(c >= 0x61 && c <= 0x7a)) return false; // a-z
		}
		i = colon + 1;
	}
	if (i >= tag.length) return false;
	// First body char: [a-z0-9].
	const first = tag.charCodeAt(i);
	const firstOk =
		(first >= 0x61 && first <= 0x7a) || (first >= 0x30 && first <= 0x39);
	if (!firstOk) return false;
	i++;
	// Remaining body: [a-z0-9-]*.
	for (; i < tag.length; i++) {
		const c = tag.charCodeAt(i);
		const ok =
			(c >= 0x61 && c <= 0x7a) || (c >= 0x30 && c <= 0x39) || c === 0x2d; // '-'
		if (!ok) return false;
	}
	return true;
}

/**
 * Format validation errors for console output
 */
export function formatValidationErrors(result: ValidationResult): string {
	const lines: string[] = [];

	if (result.errors.length > 0) {
		lines.push("VALIDATION ERRORS:");
		for (const error of result.errors) {
			lines.push(
				`  ❌ ${error.repo}: ${error.message} (${error.field}="${error.value}")`,
			);
		}
	}

	if (result.warnings.length > 0) {
		lines.push("VALIDATION WARNINGS:");
		for (const warning of result.warnings) {
			lines.push(
				`  ⚠️  ${warning.repo}: ${warning.message} (${warning.field}="${warning.value}")`,
			);
		}
	}

	if (result.valid && result.warnings.length === 0) {
		lines.push("✅ All validations passed successfully");
	}

	return lines.join("\n");
}
