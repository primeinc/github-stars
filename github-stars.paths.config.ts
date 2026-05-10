// Canonical first-party repo-relative static-path catalog.
//
// Single source of truth for paths that:
//   - cross module boundaries (consumed in 2+ files), AND
//   - are repo-relative (NOT runtime state-tree paths or per-call
//     dynamic outputs).
//
// `src/contracts/paths.ts` loads this file via a static import + a
// pass-through SyncAdapter (NOT zod-config's scriptAdapter — see
// `paths.ts` header for the bun build --compile reason), validates
// against `GhStarsPathsConfigSchema`, and re-exports a typed
// dictionary + a Zod-enum schema. Adding a path = one entry here.
//
// Doctrine source: ../../juv2/juvenal.paths.config.ts (shape).

import { defineGhStarsPathsConfig } from "./src/contracts/paths-config.js";

export default defineGhStarsPathsConfig({
	entries: [
		// ─── Manifest + fetch artifacts (the data backbone) ───────────────
		{
			key: "reposManifest",
			path: "repos.yml",
		},
		{
			key: "reposTemplate",
			path: ".github-stars/repos-template.yml",
		},
		{
			key: "fetchedStarsGraphql",
			path: ".github-stars/data/fetched-stars-graphql.json",
		},

		// ─── Schemas (JSON Schema projections of Zod contracts) ───────────
		{
			key: "reposSchemaJson",
			path: "schemas/repos-schema.json",
		},

		// ─── Generated docs surface ───────────────────────────────────────
		{
			key: "topReadme",
			path: "README.md",
		},
		{
			key: "categoriesDir",
			path: "categories",
		},
		{
			key: "tagsDir",
			path: "tags",
		},

		// ─── Web app data feeds ───────────────────────────────────────────
		{
			key: "webPublicDataJson",
			path: "web/public/data.json",
		},
		{
			key: "docsDataJson",
			path: "docs/data.json",
		},

		// ─── GraphQL query files (loaded by the fetcher at startup) ───────
		{
			key: "starsListQuery",
			path: "queries/stars-list-query.graphql",
		},
		{
			key: "starsMetadataFragment",
			path: "queries/stars-metadata-fragment.graphql",
		},

		// ─── Generated paths.json projection (for non-TS consumers) ───────
		// Workflow YAML, package.json scripts, biome.json includes, and
		// any shell tooling read this JSON instead of importing TS.
		// Emitted by `src/contracts/paths-codegen.ts`; the registry rule
		// in `src/generated/registry.ts` policies it as `committed`.
		{
			key: "generatedPathsJson",
			path: "generated/paths.json",
		},

		// ─── CLI dual-write report root (per Phase C7) ────────────────────
		{
			key: "cliReportsRoot",
			path: ".github-stars/cli-reports",
		},
	],
});
