/**
 * Type definitions for the repos.yml manifest structure
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

export interface ValidationError {
	repo: string;
	field: string;
	value: string;
	message: string;
}

export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
	warnings: ValidationError[];
}
