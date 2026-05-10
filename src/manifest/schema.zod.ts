// Canonical Zod schema for `repos.yml` (the manifest).
//
// This file is the SOURCE OF TRUTH for the manifest contract. Every
// runtime parse + the published `schemas/repos-schema.json` derive
// from this single declaration:
//
//   - Runtime parse           ManifestSchema.parse(yaml.load(text))
//   - JSON-Schema bridge      z.toJSONSchema(ManifestSchema)
//                             — written to schemas/repos-schema.json by
//                             src/manifest/schema-codegen.ts
//   - Boundary validator      compileManifestValidator() returns an
//                             @exodus/schemasafe parser bound to that
//                             same JSON Schema (defense-in-depth)
//
// Doctrine source:
//   - Zod metadata canon: refs/colinhacks/zod/packages/docs/content/metadata.mdx
//   - JSON-Schema-from-Zod: refs/colinhacks/zod/packages/docs/content/json-schema.mdx
//   - schemasafe parser API: refs/ExodusMovement/schemasafe/README.md L60-81
//
// The Zod schema layers TSDoc + .register() per the project's
// canonical layered TSDoc + Zod pattern (see
// `feedback_zod_metadata_canonical.md`). Every public schema and
// its inferred type carries `@public`.

import * as z from "zod";
import { registerSchemaById } from "../contracts/registry.js";

// ─── Reusable primitives ─────────────────────────────────────────────

const RepoIdentifierSchema = z
	.string()
	.trim()
	.regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9._-]+$/, {
		error: "repo must be in `owner/name` format",
	});

const CategoryNameSchema = z
	.string()
	.trim()
	.regex(/^[a-z][a-z0-9-]*$/)
	.min(2)
	.max(50);

// Tag-name predicate as a char-walk instead of a regex with
// alternation. eslint-plugin-security flags any alternation regex as
// "unsafe" by default; this predicate has the same shape — optional
// `<scope>:` prefix (lowercase letters), then `[a-z0-9]` first char,
// then `[a-z0-9-]*` body — without the alternation, so no
// detect-unsafe-regex finding to suppress.
function isValidTagFormat(tag: string): boolean {
	if (tag.length === 0) return false;
	let i = 0;
	const colon = tag.indexOf(":");
	if (colon > 0) {
		for (let j = 0; j < colon; j++) {
			const c = tag.charCodeAt(j);
			if (!(c >= 0x61 && c <= 0x7a)) return false; // a-z
		}
		i = colon + 1;
	}
	if (i >= tag.length) return false;
	const first = tag.charCodeAt(i);
	const firstOk =
		(first >= 0x61 && first <= 0x7a) || (first >= 0x30 && first <= 0x39);
	if (!firstOk) return false;
	i++;
	for (; i < tag.length; i++) {
		const c = tag.charCodeAt(i);
		const ok =
			(c >= 0x61 && c <= 0x7a) || (c >= 0x30 && c <= 0x39) || c === 0x2d; // '-'
		if (!ok) return false;
	}
	return true;
}
const TagNameSchema = z.string().trim().refine(isValidTagFormat, {
	error: "tag must match `<scope:>?<lowercase-alphanumeric-and-dashes>`",
});

const FrameworkNameSchema = z
	.string()
	.trim()
	.regex(/^[a-z][a-z0-9-]*$/);

const Iso8601DateTimeSchema = z.iso.datetime();
const Iso8601DateSchema = z.iso.date();
const SemverVersionSchema = z
	.string()
	.trim()
	.regex(/^v?\d+\.\d+\.\d+$/);
const GitShaSchema = z
	.string()
	.trim()
	.regex(/^[a-f0-9]{40}$/);
const GitHubUsernameSchema = z
	.string()
	.trim()
	.regex(/^[a-zA-Z0-9]([a-zA-Z0-9-])*$/);

// ─── Top-level schema components ─────────────────────────────────────

/**
 * Manifest metadata block — bookkeeping fields that describe the
 * manifest itself (when generated, who owns the stars, version of
 * the generator).
 *
 * @public
 */
export const ManifestMetadataSchema = registerSchemaById(
	z.strictObject({
		generated_at: Iso8601DateTimeSchema,
		manifest_updated_at: Iso8601DateTimeSchema,
		total_repos: z.int().min(0),
		generator_version: SemverVersionSchema.optional(),
		github_user: GitHubUsernameSchema.optional(),
	}),
	{
		id: "contract.github-stars.manifest.metadata.v1",
		title: "Manifest Metadata",
		description:
			"Bookkeeping fields describing the manifest itself (timestamps, total_repos, generator version, github user).",
		owner: "src/manifest/schema.zod.ts",
		version: "1.0.0",
		stability: "p1",
	},
);

/**
 * Feature-flag block. Toggles for AI sort, AI summarization, batching,
 * archive handling, and submodule policy.
 *
 * @public
 */
export const FeatureFlagsSchema = registerSchemaById(
	z.strictObject({
		ai_sort: z.boolean(),
		ai_summarize_nondescript: z.boolean(),
		batch_threshold: z.int().min(1).max(100),
		auto_merge: z.boolean(),
		archive_handling: z.enum([
			"skip",
			"separate-directory",
			"include-with-flag",
		]),
		submodule_update_default: z.enum(["latest", "pinned"]).optional(),
		enable_submodule_updates: z.boolean().optional(),
	}),
	{
		id: "contract.github-stars.manifest.feature-flags.v1",
		title: "Feature Flags",
		description:
			"Toggles for AI sort, batching, archive handling, submodule policy.",
		owner: "src/manifest/schema.zod.ts",
		version: "1.0.0",
		stability: "p1",
	},
);

/**
 * Taxonomy block — controlled vocabularies for categories, tags, and
 * frameworks. The validator (`src/manifest/validator.ts`) reads this
 * block to gate per-repo classification.
 *
 * @public
 */
export const TaxonomySchema = registerSchemaById(
	z.strictObject({
		categories_allowed: z.array(CategoryNameSchema).min(1),
		tags_allowed: z
			.array(
				z.strictObject({
					name: TagNameSchema,
					description: z.string().trim().max(200).optional(),
					deprecated: z.boolean().optional(),
				}),
			)
			.optional(),
		frameworks_allowed: z.array(FrameworkNameSchema).optional(),
	}),
	{
		id: "contract.github-stars.manifest.taxonomy.v1",
		title: "Manifest Taxonomy",
		description:
			"Controlled vocabularies for categories, tags, frameworks. Drives strict validation of every repo entry.",
		owner: "src/manifest/schema.zod.ts",
		version: "1.0.0",
		stability: "p1",
	},
);

const SubmoduleConfigSchema = z.strictObject({
	update_policy: z.enum(["latest", "pinned"]).optional(),
	pinned_commit: GitShaSchema.optional(),
	exclude_from: z.array(z.string().trim()).optional(),
});

const CurationDetailsSchema = z.strictObject({
	rating: z.int().min(1).max(5).optional(),
	status: z
		.enum(["evaluating", "in-use", "archived", "learning", "reference"])
		.optional(),
	notes: z.string().trim().max(2000).optional(),
	last_used: Iso8601DateSchema.optional(),
});

const RelationshipSchema = z.strictObject({
	type: z.enum([
		"depends_on",
		"replaces",
		"replaced_by",
		"alternative_to",
		"used_with",
		"inspired_by",
		"fork_of",
	]),
	repo: RepoIdentifierSchema,
	note: z.string().trim().max(200).optional(),
});

const AiClassificationSchema = z.strictObject({
	model: z.string().trim().optional(),
	classified_at: Iso8601DateTimeSchema.optional(),
	confidence: z.number().min(0).max(1).optional(),
	prompt_version: z.string().trim().optional(),
});

const GitHubMetadataSchema = z.strictObject({
	language: z.string().trim().nullable().optional(),
	topics: z.array(z.string().trim()).optional(),
	stargazers_count: z.int().min(0).optional(),
	forks_count: z.int().min(0).optional(),
	disk_usage: z.int().nullable().optional(),
	owner_avatar: z.string().trim().nullable().optional(),
	homepage_url: z.string().trim().nullable().optional(),
	license: z.string().trim().nullable().optional(),
	repo_pushed_at: Iso8601DateTimeSchema.optional(),
	repo_updated_at: Iso8601DateTimeSchema.optional(),
	html_url: z.string().trim().optional(),
	default_branch: z.string().trim().optional(),
	latest_release: z
		.object({
			tag: z.string().trim().optional(),
			published_at: Iso8601DateTimeSchema.optional(),
		})
		.nullable()
		.optional(),
	is_mirror: z.boolean().optional(),
	mirror_url: z.string().trim().nullable().optional(),
});

/**
 * One repository entry in the manifest. The strict-object base
 * includes only the fields the schema defines; legacy / experimental
 * fields the YAML may carry are passed through `passthrough()` when
 * the validator wants tolerance.
 *
 * @public
 */
export const RepositoryEntrySchema = registerSchemaById(
	z.strictObject({
		repo: RepoIdentifierSchema,
		categories: z.array(z.string().trim()).min(1).max(5),
		tags: z.array(TagNameSchema).max(20),
		framework: FrameworkNameSchema.nullable().optional(),
		summary: z.string().trim().max(500).optional(),
		last_synced_sha: GitShaSchema,
		user_starred_at: Iso8601DateTimeSchema,

		readme_quality: z.enum(["good", "poor", "missing"]).optional(),
		archived: z.boolean().optional(),
		fork: z.boolean().optional(),
		submodule_config: SubmoduleConfigSchema.optional(),
		curation_details: CurationDetailsSchema.optional(),
		relationships: z.array(RelationshipSchema).optional(),
		ai_classification: AiClassificationSchema.optional(),
		needs_review: z.boolean().optional(),
		ignore: z.boolean().optional(),
		github_metadata: GitHubMetadataSchema.optional(),
	}),
	{
		id: "contract.github-stars.manifest.repository.v1",
		title: "Manifest Repository Entry",
		description:
			"One curated repo entry — repo identity, categories+tags, optional framework+summary, taxonomy+AI metadata, and a snapshot of upstream GitHub fields at last sync.",
		owner: "src/manifest/schema.zod.ts",
		version: "1.0.0",
		stability: "p1",
	},
);

const RelationshipGraphSchema = z.strictObject({
	last_computed: Iso8601DateTimeSchema.optional(),
	nodes: z.int().min(0).optional(),
	edges: z.int().min(0).optional(),
});

/**
 * Top-level manifest shape — the YAML deserialization target. Carries
 * the metadata block, feature flags, taxonomy, repo roster, and
 * optional pre-computed relationship graph.
 *
 * @public
 */
export const ManifestSchema = registerSchemaById(
	z.strictObject({
		schema_version: z.literal("3.0.0"),
		manifest_metadata: ManifestMetadataSchema,
		feature_flags: FeatureFlagsSchema,
		taxonomy: TaxonomySchema,
		repositories: z.array(RepositoryEntrySchema),
		relationship_graph: RelationshipGraphSchema.optional(),
	}),
	{
		id: "contract.github-stars.manifest.v1",
		title: "GitHub Stars Curation Manifest",
		description:
			"Top-level shape of repos.yml — schema version, metadata, feature flags, taxonomy, repository roster, optional relationship graph.",
		owner: "src/manifest/schema.zod.ts",
		version: "1.0.0",
		stability: "p1",
	},
);

/**
 * Inferred TS type for {@link ManifestSchema}. Use everywhere the
 * manifest crosses a module boundary.
 *
 * @public
 */
export type ManifestZ = z.infer<typeof ManifestSchema>;

/**
 * Inferred TS type for {@link ManifestMetadataSchema}.
 *
 * @public
 */
export type ManifestMetadataZ = z.infer<typeof ManifestMetadataSchema>;

/**
 * Inferred TS type for {@link FeatureFlagsSchema}.
 *
 * @public
 */
export type FeatureFlagsZ = z.infer<typeof FeatureFlagsSchema>;

/**
 * Inferred TS type for {@link TaxonomySchema}.
 *
 * @public
 */
export type TaxonomyZ = z.infer<typeof TaxonomySchema>;

/**
 * Inferred TS type for {@link RepositoryEntrySchema}.
 *
 * @public
 */
export type RepositoryEntryZ = z.infer<typeof RepositoryEntrySchema>;
