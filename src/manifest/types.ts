/**
 * Type definitions for the repos.yml manifest structure
 */

/**
 * Manifest taxonomy block: the allowed categories, frameworks, and tag
 * vocabulary that {@link Repository} entries must conform to.
 *
 * @remarks
 * Each `tags_allowed` entry may carry an optional description and a
 * deprecation flag — deprecated tags still validate but surface as
 * warnings in the validator output.
 *
 * @public
 */
export interface Taxonomy {
	categories_allowed: string[];
	frameworks_allowed?: string[];
	tags_allowed?: Array<{
		name: string;
		description?: string;
		deprecated?: boolean;
	}>;
}

/**
 * One repository entry in the manifest. Carries the human-curated
 * classification (categories, tags, optional framework + summary) plus
 * a snapshot of the upstream GitHub metadata at last sync.
 *
 * @remarks
 * `[key: string]: unknown` is a deliberate escape hatch — the manifest
 * is YAML-edited by humans and may carry experimental fields that
 * predate or postdate the typed surface. Code that needs a typed field
 * must read it through the validator, not through the index signature.
 *
 * @public
 */
export interface Repository {
	repo: string;
	categories: string[];
	tags: string[];
	framework?: string | null;
	summary?: string;
	last_synced_sha: string;
	user_starred_at: string;
	needs_review?: boolean;
	ai_classification?: {
		model?: string;
		classified_at?: string;
		confidence?: number;
		prompt_version?: string;
	};
	github_metadata?: {
		language?: string | null;
		topics?: string[];
		stargazers_count?: number;
		[key: string]: unknown;
	};
	[key: string]: unknown;
}

/**
 * Top-level manifest shape — what `repos.yml` deserializes to. Includes
 * a metadata block, the taxonomy that gates validation, the repo
 * roster, and a free-form `feature_flags` map.
 *
 * @public
 */
export interface Manifest {
	schema_version: string;
	manifest_metadata: {
		generated_at: string;
		manifest_updated_at: string;
		total_repos: number;
		generator_version?: string;
		github_user?: string;
	};
	feature_flags: {
		[key: string]: unknown;
	};
	taxonomy: Taxonomy;
	repositories: Repository[];
	[key: string]: unknown;
}

/**
 * Result of normalizing a manifest in place: the new manifest, the
 * per-repo change ledger, and a summary block for stdout / GitHub
 * Actions outputs.
 *
 * @public
 */
export interface NormalizationResult {
	manifest: Manifest;
	changedRepos: Array<{
		repo: string;
		changes: string[];
	}>;
	summary: {
		totalRepos: number;
		modifiedRepos: number;
		needsReviewCount: number;
	};
}

/**
 * One row in {@link ValidationResult.errors} or
 * {@link ValidationResult.warnings}. Identifies the offending repo,
 * the field path, the offending value, and a human-readable message.
 *
 * @public
 */
export interface ValidationError {
	repo: string;
	field: string;
	value: string;
	message: string;
}

/**
 * Aggregate validation outcome. `valid` is true iff `errors` is empty;
 * warnings never affect validity.
 *
 * @public
 */
export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
	warnings: ValidationError[];
}
