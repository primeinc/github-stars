// Pure reconciliation between fetched stars and the existing manifest.
//
// Extracted from .github/workflows/02-sync-stars.yml's actions/github-script
// block. The 5% destructive-deletion guard is the load-bearing safety net
// that prevented future repeats of the .sisyphus/proofs/02N-recovery.md
// incident (silent partial fetches truncated repos.yml from 2,612 → 197).

import type { FetchedRepo } from "../fetch/types.js";

export type ManifestRepo = {
	repo: string;
	categories?: string[];
	tags?: string[];
	summary?: string;
	last_synced_sha?: string;
	user_starred_at?: string;
	readme_quality?: string;
	needs_review?: boolean;
	archived?: boolean;
	fork?: boolean;
	ai_classification?: unknown;
	github_metadata?: Record<string, unknown>;
	[key: string]: unknown;
};

export type Manifest = {
	schema_version?: string;
	manifest_metadata?: Record<string, unknown> & {
		github_user?: string;
		manifest_updated_at?: string;
		total_repos?: number;
	};
	feature_flags?: unknown;
	taxonomy?: unknown;
	repositories: ManifestRepo[];
};

export type ReconcileOptions = {
	manifest: Manifest;
	fetched: FetchedRepo[];
	/** Default 0.05 (5%). */
	removalThreshold?: number;
	/** Pre-resolved github user; overrides manifest_metadata.github_user. */
	githubUser?: string;
	/** Bypass the destructive-deletion guard (workflow input). */
	removalOverride?: boolean;
	now?: () => Date;
};

export type ReconcileOutcome =
	| { kind: "ok"; manifest: Manifest; stats: ReconcileStats }
	| { kind: "destructive"; reason: string; stats: ReconcileStats };

export type ReconcileStats = {
	total_new: number;
	total_removed: number;
	total_updated: number;
	total_repos: number;
	removal_ratio: number;
	changed: boolean;
};

export const DEFAULT_REMOVAL_THRESHOLD = 0.05;

export function reconcile(opts: ReconcileOptions): ReconcileOutcome {
	const threshold = opts.removalThreshold ?? DEFAULT_REMOVAL_THRESHOLD;
	const now = opts.now ?? (() => new Date());
	// Deep-copy repositories so the metadata-sync loop below cannot mutate
	// the caller's input. Shallow array copy is not enough — entries get
	// mutated in place (last_synced_sha, github_metadata, user_starred_at).
	// Build manifest_metadata with all fields known-defined at construction
	// time. Avoids `!` non-null assertions later (biome rule
	// noNonNullAssertion) and gives the type checker a complete object to
	// narrow on. Caller's existing values win; we only fill missing ones.
	const sourceMetadata = opts.manifest.manifest_metadata ?? {};
	const initialUpdatedAt =
		typeof sourceMetadata.manifest_updated_at === "string"
			? sourceMetadata.manifest_updated_at
			: now().toISOString();
	const manifestMetadata: Manifest["manifest_metadata"] = {
		...sourceMetadata,
		manifest_updated_at: initialUpdatedAt,
		total_repos:
			typeof sourceMetadata.total_repos === "number"
				? sourceMetadata.total_repos
				: opts.manifest.repositories.length,
		...(opts.githubUser !== undefined ? { github_user: opts.githubUser } : {}),
	};
	const manifest: Manifest = {
		...opts.manifest,
		manifest_metadata: manifestMetadata,
		repositories: opts.manifest.repositories.map((r) => ({
			...r,
			github_metadata: r.github_metadata ? { ...r.github_metadata } : undefined,
		})),
	};

	const existingRepos = new Set(
		manifest.repositories.filter((r) => r?.repo).map((r) => r.repo),
	);
	const newRepos = opts.fetched.filter(
		(s) => s?.repo && !existingRepos.has(s.repo),
	);
	const currentStarRepos = new Set(
		opts.fetched.filter((s) => s?.repo).map((s) => s.repo),
	);
	const removedRepos = manifest.repositories.filter(
		(r) => r?.repo && !currentStarRepos.has(r.repo),
	);

	const manifestSize = manifest.repositories.length;
	const removal_ratio =
		manifestSize > 0 ? removedRepos.length / manifestSize : 0;

	if (!opts.removalOverride && removal_ratio > threshold) {
		const removedNames = removedRepos
			.slice(0, 20)
			.map((r) => r.repo)
			.join(", ");
		return {
			kind: "destructive",
			reason:
				`DESTRUCTIVE SYNC REFUSED: fetched ${opts.fetched.length} stars but manifest has ${manifestSize}; ` +
				`that would remove ${removedRepos.length} repos (${(removal_ratio * 100).toFixed(1)}% — exceeds ` +
				`${(threshold * 100).toFixed(0)}% threshold). First 20: ${removedNames}` +
				`${removedRepos.length > 20 ? ", ..." : ""}.`,
			stats: {
				total_new: newRepos.length,
				total_removed: removedRepos.length,
				total_updated: 0,
				total_repos: manifestSize,
				removal_ratio,
				changed: false,
			},
		};
	}

	if (newRepos.length > 0 || removedRepos.length > 0) {
		manifest.repositories = manifest.repositories.filter(
			(r) => r?.repo && currentStarRepos.has(r.repo),
		);
		for (const fresh of newRepos) {
			manifest.repositories.push(buildNewEntry(fresh, now));
		}
		manifestMetadata.manifest_updated_at = now().toISOString();
		manifestMetadata.total_repos = manifest.repositories.length;
	}

	// In-place metadata sync for retained repos.
	let updatedCount = 0;
	const fetchedByRepo = new Map(opts.fetched.map((s) => [s.repo, s]));
	for (const repo of manifest.repositories) {
		const fresh = fetchedByRepo.get(repo.repo);
		if (!fresh) continue;
		let changed = false;

		if (
			fresh.user_starred_at &&
			fresh.user_starred_at !== repo.user_starred_at
		) {
			repo.user_starred_at = fresh.user_starred_at;
			changed = true;
		}
		if (
			repo.last_synced_sha !== fresh.last_commit_sha &&
			fresh.last_commit_sha
		) {
			repo.last_synced_sha = fresh.last_commit_sha;
			changed = true;
		}
		if (
			fresh.updated_at &&
			(!repo.github_metadata ||
				(repo.github_metadata as { repo_updated_at?: string })
					.repo_updated_at !== fresh.updated_at)
		) {
			repo.github_metadata = {
				...(repo.github_metadata ?? {}),
				repo_updated_at: fresh.updated_at,
				repo_pushed_at: fresh.pushed_at,
				stargazers_count: fresh.stargazers_count,
				forks_count: fresh.forks_count,
				disk_usage: fresh.disk_usage,
				owner_avatar: fresh.owner_avatar,
				language: fresh.language,
				topics: fresh.topics,
				license: fresh.license,
			};
			changed = true;
		}
		if (changed) updatedCount++;
	}

	const changed =
		newRepos.length > 0 || removedRepos.length > 0 || updatedCount > 0;
	if (changed) {
		manifestMetadata.manifest_updated_at = now().toISOString();
		manifestMetadata.total_repos = manifest.repositories.length;
	}

	return {
		kind: "ok",
		manifest,
		stats: {
			total_new: newRepos.length,
			total_removed: removedRepos.length,
			total_updated: updatedCount,
			total_repos: manifest.repositories.length,
			removal_ratio,
			changed,
		},
	};
}

export function cleanDescription(desc: string | null | undefined): string {
	if (!desc?.trim()) return "No description provided";
	let cleaned = desc
		.replace(/^#+\s*/, "")
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/\s+/g, " ")
		.trim();
	if (cleaned.length > 200) cleaned = `${cleaned.substring(0, 197)}...`;
	return cleaned;
}

function buildNewEntry(repo: FetchedRepo, now: () => Date): ManifestRepo {
	const entry: ManifestRepo = {
		repo: repo.repo,
		categories: ["unclassified"],
		tags: [],
		summary: cleanDescription(repo.description),
		last_synced_sha: repo.last_commit_sha || "0".repeat(40),
		user_starred_at: repo.user_starred_at || now().toISOString(),
		readme_quality: "missing",
		needs_review: true,
		github_metadata: {
			language: repo.language || null,
			topics: repo.topics || [],
			stargazers_count: repo.stargazers_count || 0,
			forks_count: repo.forks_count || 0,
			disk_usage: repo.disk_usage || null,
			owner_avatar: repo.owner_avatar || null,
			homepage_url: repo.homepage_url || null,
			license: repo.license || null,
			repo_pushed_at: repo.pushed_at || null,
			repo_updated_at: repo.updated_at || null,
			html_url: repo.html_url || null,
			default_branch: repo.default_branch || null,
			latest_release: repo.latest_release || null,
			is_mirror: repo.is_mirror || false,
			mirror_url: repo.mirror_url || null,
		},
	};
	if (repo.archived) entry.archived = true;
	if (repo.fork) entry.fork = true;
	return entry;
}
