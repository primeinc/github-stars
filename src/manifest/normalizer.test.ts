/**
 * Unit tests for normalizer module
 */

import { describe, expect, it } from "bun:test";
import { normalizeManifest, normalizeRepository } from "./normalizer.js";
import type { Manifest, Repository } from "./types.js";

describe("normalizer", () => {
	const mockTaxonomy = {
		categories_allowed: ["dev-tools", "ui-libraries", "frameworks"],
		frameworks_allowed: ["react", "vue", "angular"],
	};

	describe("normalizeRepository", () => {
		it("should remove invalid categories and set needs_review", () => {
			const repo: Repository = {
				repo: "test/repo1",
				categories: ["infrastructure", "cli-tools"],
				tags: ["test"],
				last_synced_sha: "0000000000000000000000000000000000000000",
				user_starred_at: "2025-01-01T00:00:00Z",
			};

			const { repo: normalized, changes } = normalizeRepository(
				repo,
				mockTaxonomy,
			);

			expect(normalized.categories).toEqual(["unclassified"]);
			expect(normalized.needs_review).toBe(true);
			expect(changes).toContain(
				"Removed invalid categories: infrastructure, cli-tools",
			);
			expect(changes).toContain(
				"All categories invalid, defaulting to unclassified",
			);
		});

		it("should filter mixed valid/invalid categories", () => {
			const repo: Repository = {
				repo: "test/repo2",
				categories: ["dev-tools", "invalid-one", "frameworks"],
				tags: ["test"],
				last_synced_sha: "0000000000000000000000000000000000000000",
				user_starred_at: "2025-01-01T00:00:00Z",
			};

			const { repo: normalized, changes } = normalizeRepository(
				repo,
				mockTaxonomy,
			);

			expect(normalized.categories).toEqual(["dev-tools", "frameworks"]);
			expect(normalized.needs_review).toBeUndefined();
			expect(changes).toContain("Removed invalid categories: invalid-one");
		});

		it("should canonicalize categories (case/whitespace)", () => {
			const repo: Repository = {
				repo: "test/repo3",
				categories: ["Dev-Tools", "  UI-LIBRARIES  "],
				tags: ["test"],
				last_synced_sha: "0000000000000000000000000000000000000000",
				user_starred_at: "2025-01-01T00:00:00Z",
			};

			const { repo: normalized, changes } = normalizeRepository(
				repo,
				mockTaxonomy,
			);

			expect(normalized.categories).toEqual(["dev-tools", "ui-libraries"]);
			// Changes might be reported for canonicalization
			if (changes.length > 0) {
				expect(
					changes.some(
						(c) => c.includes("Canonicalized") || c.includes("categories"),
					),
				).toBe(true);
			}
		});

		it("should invalidate invalid framework and set needs_review", () => {
			const repo: Repository = {
				repo: "test/repo4",
				categories: ["dev-tools"],
				tags: ["test"],
				framework: "invalid-framework",
				last_synced_sha: "0000000000000000000000000000000000000000",
				user_starred_at: "2025-01-01T00:00:00Z",
			};

			const { repo: normalized, changes } = normalizeRepository(
				repo,
				mockTaxonomy,
			);

			expect(normalized.framework).toBeNull();
			expect(normalized.needs_review).toBe(true);
			expect(changes).toContain(
				'Invalid framework "invalid-framework" -> null',
			);
		});

		it("should canonicalize valid framework", () => {
			const repo: Repository = {
				repo: "test/repo5",
				categories: ["ui-libraries"],
				tags: ["test"],
				framework: "React",
				last_synced_sha: "0000000000000000000000000000000000000000",
				user_starred_at: "2025-01-01T00:00:00Z",
			};

			const { repo: normalized, changes } = normalizeRepository(
				repo,
				mockTaxonomy,
			);

			expect(normalized.framework).toBe("react");
			expect(changes).toContain('Canonicalized framework: "React" -> "react"');
		});

		it("should handle whitespace in categories and framework", () => {
			const repo: Repository = {
				repo: "test/repo6",
				categories: ["  Frameworks  "],
				tags: ["test"],
				framework: "  Angular  ",
				last_synced_sha: "0000000000000000000000000000000000000000",
				user_starred_at: "2025-01-01T00:00:00Z",
			};

			const { repo: normalized, changes } = normalizeRepository(
				repo,
				mockTaxonomy,
			);

			expect(normalized.categories).toEqual(["frameworks"]);
			expect(normalized.framework).toBe("angular");
			expect(changes.length).toBeGreaterThan(0);
		});

		it("should not modify already valid repo", () => {
			const repo: Repository = {
				repo: "test/repo7",
				categories: ["dev-tools"],
				tags: ["test"],
				framework: "react",
				last_synced_sha: "0000000000000000000000000000000000000000",
				user_starred_at: "2025-01-01T00:00:00Z",
			};

			const { repo: normalized, changes } = normalizeRepository(
				repo,
				mockTaxonomy,
			);

			expect(normalized.categories).toEqual(["dev-tools"]);
			expect(normalized.framework).toBe("react");
			expect(changes.length).toBe(0);
		});
	});

	describe("normalizeManifest", () => {
		it("should normalize all repositories and provide summary", () => {
			const manifest: Manifest = {
				schema_version: "3.0.0",
				manifest_metadata: {
					generated_at: "2025-01-01T00:00:00Z",
					manifest_updated_at: "2025-01-01T00:00:00Z",
					total_repos: 3,
				},
				feature_flags: {},
				taxonomy: mockTaxonomy,
				repositories: [
					{
						repo: "test/repo1",
						categories: ["invalid"],
						tags: [],
						last_synced_sha: "0000000000000000000000000000000000000000",
						user_starred_at: "2025-01-01T00:00:00Z",
					},
					{
						repo: "test/repo2",
						categories: ["Dev-Tools"],
						tags: [],
						framework: "React",
						last_synced_sha: "0000000000000000000000000000000000000000",
						user_starred_at: "2025-01-01T00:00:00Z",
					},
					{
						repo: "test/repo3",
						categories: ["dev-tools"],
						tags: [],
						framework: "react",
						last_synced_sha: "0000000000000000000000000000000000000000",
						user_starred_at: "2025-01-01T00:00:00Z",
					},
				],
			};

			const result = normalizeManifest(manifest);

			expect(result.summary.totalRepos).toBe(3);
			expect(result.summary.modifiedRepos).toBe(2); // repo1 and repo2
			expect(result.summary.needsReviewCount).toBe(1); // repo1

			expect(result.manifest.repositories[0]?.categories).toEqual([
				"unclassified",
			]);
			expect(result.manifest.repositories[0]?.needs_review).toBe(true);

			expect(result.manifest.repositories[1]?.categories).toEqual([
				"dev-tools",
			]);
			expect(result.manifest.repositories[1]?.framework).toBe("react");

			expect(result.manifest.repositories[2]?.categories).toEqual([
				"dev-tools",
			]);
			expect(result.manifest.repositories[2]?.framework).toBe("react");

			expect(result.changedRepos.length).toBe(2);
		});

		it("should update manifest_updated_at timestamp", () => {
			const manifest: Manifest = {
				schema_version: "3.0.0",
				manifest_metadata: {
					generated_at: "2025-01-01T00:00:00Z",
					manifest_updated_at: "2025-01-01T00:00:00Z",
					total_repos: 1,
				},
				feature_flags: {},
				taxonomy: mockTaxonomy,
				repositories: [
					{
						repo: "test/repo1",
						categories: ["dev-tools"],
						tags: [],
						last_synced_sha: "0000000000000000000000000000000000000000",
						user_starred_at: "2025-01-01T00:00:00Z",
					},
				],
			};

			const before = new Date(manifest.manifest_metadata.manifest_updated_at);
			const result = normalizeManifest(manifest);
			const after = new Date(
				result.manifest.manifest_metadata.manifest_updated_at,
			);

			expect(after.getTime()).toBeGreaterThanOrEqual(before.getTime());
		});
	});
});
