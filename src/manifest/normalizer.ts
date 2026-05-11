/**
 * Normalizer module for canonicalizing and fixing manifest data
 */

import {
	canonicalize,
	filterValidCategories,
	validateFramework,
} from "./taxonomy.js";
import type { Manifest, NormalizationResult, Repository } from "./types.js";

/**
 * Normalize a single repository's categories and framework
 * Returns the modified repository and a list of changes made
 */
export function normalizeRepository(
	repo: Repository,
	taxonomy: Manifest["taxonomy"],
): { repo: Repository; changes: string[] } {
	const changes: string[] = [];
	const normalized = { ...repo };

	// Normalize categories: trim, lowercase, filter against taxonomy
	const originalCategories = [...(repo.categories || [])];
	const validCategories = filterValidCategories(originalCategories, taxonomy);

	// Track removed categories
	const removedCategories = originalCategories
		.map(canonicalize)
		.filter((cat) => !validCategories.includes(cat));

	if (removedCategories.length > 0) {
		changes.push(`Removed invalid categories: ${removedCategories.join(", ")}`);
	}

	// If all categories were invalid or none remain, fall back to unclassified
	if (validCategories.length === 0) {
		normalized.categories = ["unclassified"];
		if (originalCategories.length > 0) {
			changes.push("All categories invalid, defaulting to unclassified");
			normalized.needs_review = true;
		}
	} else {
		normalized.categories = validCategories;

		// Check if canonicalization changed the categories
		const categoriesChanged =
			originalCategories.length !== validCategories.length ||
			!originalCategories.every(
				(cat, i) => canonicalize(cat) === validCategories[i],
			);

		if (categoriesChanged && removedCategories.length === 0) {
			changes.push("Canonicalized categories (case/whitespace)");
		}
	}

	// Normalize framework: validate against taxonomy or set to null
	const originalFramework = repo.framework;
	const validFramework = validateFramework(originalFramework, taxonomy);

	if (originalFramework !== validFramework) {
		normalized.framework = validFramework;

		if (originalFramework && !validFramework) {
			changes.push(`Invalid framework "${originalFramework}" -> null`);
			normalized.needs_review = true;
		} else if (
			originalFramework &&
			validFramework &&
			originalFramework !== validFramework
		) {
			changes.push(
				`Canonicalized framework: "${originalFramework}" -> "${validFramework}"`,
			);
		}
	}

	return { repo: normalized, changes };
}

/**
 * Normalize the entire manifest
 * Returns the normalized manifest with a summary of changes
 */
export function normalizeManifest(manifest: Manifest): NormalizationResult {
	const changedRepos: Array<{ repo: string; changes: string[] }> = [];
	const normalizedRepos: Repository[] = [];

	for (const repo of manifest.repositories) {
		const { repo: normalized, changes } = normalizeRepository(
			repo,
			manifest.taxonomy,
		);
		normalizedRepos.push(normalized);

		if (changes.length > 0) {
			changedRepos.push({
				repo: repo.repo,
				changes,
			});
		}
	}

	const needsReviewCount = normalizedRepos.filter((r) => r.needs_review).length;

	return {
		manifest: {
			...manifest,
			repositories: normalizedRepos,
			manifest_metadata: {
				...manifest.manifest_metadata,
				manifest_updated_at: new Date().toISOString(),
			},
		},
		changedRepos,
		summary: {
			totalRepos: normalizedRepos.length,
			modifiedRepos: changedRepos.length,
			needsReviewCount,
		},
	};
}
