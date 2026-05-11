// Repository shape consumed by the static site. Must stay aligned
// with the manifest entries written by the server-side pipeline
// (src/manifest/schema.zod.ts → RepositoryEntrySchema). Kept as a
// hand-written interface here because the web/ workspace is
// dependency-isolated from the kernel; importing the Zod schema
// would cross the workspace boundary.

export interface ManifestRepoEntry {
	repo: string;
	summary?: string;
	categories?: string[];
	user_starred_at?: string;
	archived?: boolean;
	github_metadata?: {
		html_url?: string;
		homepage_url?: string | null;
		stargazers_count?: number;
		forks_count?: number;
		language?: string | null;
		topics?: string[];
		repo_pushed_at?: string | null;
		is_template?: boolean;
		owner_avatar?: string | null;
	};
}

export interface ManifestData {
	repositories?: ManifestRepoEntry[];
}

/** Flattened, presentation-ready repo shape. */
export interface Repo {
	repo: string;
	summary: string;
	categories: string[];
	html_url: string;
	homepage_url: string | null;
	stars: number;
	forks: number;
	language: string;
	topics: string[];
	user_starred_at: string | null;
	pushed_at: string | null;
	is_template: boolean;
	archived: boolean;
	avatar: string | null;
}

export type SortKey = "starred" | "stars" | "pushed" | "name";

export interface Filters {
	search: string;
	category: string | null;
	language: string | null;
	topic: string | null;
	archived: boolean;
	template: boolean;
}
