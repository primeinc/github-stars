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

		// Validate tag format (warning only)
		const tagPattern = /^([a-z]+:)?[a-z0-9][a-z0-9-]*$/;
		for (const tag of repo.tags || []) {
			if (!tagPattern.test(tag)) {
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
