#!/usr/bin/env node
/**
 * One-shot recovery: merge fresh REST fetch with existing classifications.
 *
 * INPUTS:
 *   .github-stars/data/fetched-stars-graphql.json — fresh REST snapshot (2,612 public repos)
 *   web/public/data.json — last surviving manifest with classifications (2,085 entries from 2026-01-29)
 *   repos.yml — current truncated state (197 entries; used for taxonomy + feature_flags + manifest_metadata shell)
 *
 * OUTPUT:
 *   repos.yml-recovered.yml — full reconstruction (~2,612 entries)
 *
 * MERGE LOGIC:
 *   For each repo in fresh REST fetch:
 *     - If repo exists in current repos.yml: keep its classification (categories/tags/summary/ai_classification),
 *       update github_metadata + user_starred_at from fresh.
 *     - Else if repo exists in web/public/data.json (snapshot): inherit classification from there,
 *       update github_metadata + user_starred_at from fresh.
 *     - Else (new since both snapshots): add as unclassified, needs_review=true (matches 02-sync L206-234 shape).
 *
 *   Removed repos (in repos.yml but not in fresh): drop them — these are unstarred or moved/renamed.
 *
 * SAFETY: writes to a NEW file (`repos.yml-recovered.yml`). Does NOT touch
 * `repos.yml` directly. User must manually `mv` after inspection.
 */

import { readFileSync, writeFileSync } from "node:fs";
import yaml from "js-yaml";

const FRESH_PATH = ".github-stars/data/fetched-stars-graphql.json";
const SNAPSHOT_PATH = "web/public/data.json";
const CURRENT_PATH = "repos.yml";
const OUTPUT_PATH = "repos.yml-recovered.yml";

function loadYaml(path) {
	return yaml.load(readFileSync(path, "utf8"));
}

function loadJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

function cleanDescription(desc) {
	// Match 02-sync's cleanDescription (L195-203 of 02-sync-stars.yml)
	if (!desc?.trim()) return "No description provided";
	const cleaned = desc
		.replace(/^#+\s*/, "")
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/\s+/g, " ")
		.trim();
	return cleaned.length > 200 ? cleaned.substring(0, 197) + "..." : cleaned;
}

function buildGithubMetadata(fresh) {
	return {
		language: fresh.language || null,
		topics: fresh.topics || [],
		stargazers_count: fresh.stargazers_count || 0,
		forks_count: fresh.forks_count || 0,
		disk_usage: fresh.disk_usage || null,
		owner_avatar: fresh.owner_avatar || null,
		homepage_url: fresh.homepage_url || null,
		license: fresh.license || null,
		repo_pushed_at: fresh.pushed_at || null,
		repo_updated_at: fresh.updated_at || null,
		html_url: fresh.html_url || null,
		default_branch: fresh.default_branch || null,
		latest_release: fresh.latest_release || null,
		is_mirror: fresh.is_mirror || false,
		mirror_url: fresh.mirror_url || null,
	};
}

function newEntry(fresh) {
	// Matches 02-sync L206-234 newEntries shape
	return {
		repo: fresh.repo,
		categories: ["unclassified"],
		tags: [],
		summary: cleanDescription(fresh.description),
		last_synced_sha: fresh.last_commit_sha || "0".repeat(40),
		user_starred_at: fresh.user_starred_at || new Date().toISOString(),
		readme_quality: "missing",
		needs_review: true,
		...(fresh.archived && { archived: true }),
		...(fresh.fork && { fork: true }),
		github_metadata: buildGithubMetadata(fresh),
	};
}

function inheritEntry(fresh, prior) {
	// Take classification from prior, overlay fresh metadata.
	// Same shape as a "synced" entry per 02-sync L246-280.
	const out = {
		repo: fresh.repo,
		categories: prior.categories || ["unclassified"],
		tags: prior.tags || [],
		summary: prior.summary || cleanDescription(fresh.description),
		last_synced_sha:
			prior.last_synced_sha || fresh.last_commit_sha || "0".repeat(40),
		user_starred_at: fresh.user_starred_at || prior.user_starred_at,
		readme_quality: prior.readme_quality || "missing",
		needs_review: prior.needs_review !== undefined ? prior.needs_review : true,
	};
	if (fresh.archived) out.archived = true;
	if (fresh.fork) out.fork = true;
	if (prior.ai_classification) out.ai_classification = prior.ai_classification;
	out.github_metadata = buildGithubMetadata(fresh);
	return out;
}

function main() {
	console.log("Loading fresh REST fetch...");
	const fresh = loadJson(FRESH_PATH);
	console.log(`  ${fresh.length} fresh repos`);

	console.log(
		"Loading classification snapshot (web/public/data.json @ 2026-01-29)...",
	);
	const snapshot = loadJson(SNAPSHOT_PATH);
	const snapshotRepos = snapshot.repositories || [];
	console.log(`  ${snapshotRepos.length} snapshot repos`);

	console.log(`Loading current repos.yml (${CURRENT_PATH})...`);
	const current = loadYaml(CURRENT_PATH);
	const currentRepos = current.repositories || [];
	console.log(`  ${currentRepos.length} current repos`);

	// Build lookup maps
	const currentByName = new Map(
		currentRepos.filter((r) => r?.repo).map((r) => [r.repo, r]),
	);
	const snapshotByName = new Map(
		snapshotRepos.filter((r) => r?.repo).map((r) => [r.repo, r]),
	);

	// For each fresh repo, build merged entry
	let fromCurrent = 0;
	let fromSnapshot = 0;
	let asNew = 0;
	const merged = fresh.map((f) => {
		if (currentByName.has(f.repo)) {
			fromCurrent++;
			return inheritEntry(f, currentByName.get(f.repo));
		}
		if (snapshotByName.has(f.repo)) {
			fromSnapshot++;
			return inheritEntry(f, snapshotByName.get(f.repo));
		}
		asNew++;
		return newEntry(f);
	});

	// Sort by user_starred_at desc to match the canonical ordering 04/05 expect
	merged.sort((a, b) => {
		const at = a.user_starred_at ? new Date(a.user_starred_at).getTime() : 0;
		const bt = b.user_starred_at ? new Date(b.user_starred_at).getTime() : 0;
		return bt - at;
	});

	// Build output manifest preserving feature_flags + taxonomy from current
	const output = {
		schema_version: current.schema_version || "3.0.0",
		manifest_metadata: {
			...current.manifest_metadata,
			manifest_updated_at: new Date().toISOString(),
			total_repos: merged.length,
			github_user: current.manifest_metadata?.github_user || "primeinc",
		},
		feature_flags: current.feature_flags,
		taxonomy: current.taxonomy,
		repositories: merged,
	};

	// Write YAML directly via js-yaml (already a project dependency)
	const yamlText = yaml.dump(output, {
		lineWidth: -1, // never wrap long URLs/descriptions
		noRefs: true,
		sortKeys: false,
		forceQuotes: false,
	});
	writeFileSync(OUTPUT_PATH, yamlText);

	console.log(`\nReconstruction complete:`);
	console.log(
		`  ${fromCurrent} repos kept classification from current repos.yml (197 prior)`,
	);
	console.log(
		`  ${fromSnapshot} repos inherited classification from web/public/data.json snapshot`,
	);
	console.log(`  ${asNew} repos new (will need classification)`);
	console.log(`  ${merged.length} total — written to ${OUTPUT_PATH}`);
	console.log(
		`\nRemoved (in current but not in fresh): ${[...currentByName.keys()].filter((k) => !fresh.find((f) => f.repo === k)).length}`,
	);
}

main();
