import { describe, expect, it } from "bun:test";
import type { FetchedRepo } from "../fetch/types.js";
import {
	cleanDescription,
	DEFAULT_REMOVAL_THRESHOLD,
	reconcile,
} from "./reconcile.js";

const FIXED_DATE = new Date("2026-05-10T00:00:00.000Z");
const now = () => FIXED_DATE;

function fetched(
	repo: string,
	overrides: Partial<FetchedRepo> = {},
): FetchedRepo {
	return {
		repo,
		description: "",
		language: null,
		topics: [],
		archived: false,
		fork: false,
		private: false,
		stargazers_count: 0,
		forks_count: 0,
		updated_at: null,
		pushed_at: null,
		disk_usage: null,
		owner_avatar: null,
		html_url: null,
		default_branch: "main",
		last_commit_sha: "a".repeat(40),
		user_starred_at: "2026-01-01T00:00:00Z",
		homepage_url: null,
		is_mirror: false,
		mirror_url: null,
		license: null,
		latest_release: null,
		...overrides,
	};
}

describe("reconcile — destructive guard", () => {
	it("refuses removal exceeding 5% threshold", () => {
		const manifest = {
			repositories: Array.from({ length: 100 }, (_, i) => ({
				repo: `o/r${i}`,
			})),
		};
		const fetchedSubset = Array.from({ length: 80 }, (_, i) =>
			fetched(`o/r${i}`),
		); // would remove 20
		const r = reconcile({ manifest, fetched: fetchedSubset, now });
		expect(r.kind).toBe("destructive");
		if (r.kind === "destructive") {
			expect(r.reason).toContain("20 repos");
			expect(r.stats.total_removed).toBe(20);
		}
	});

	it("allows removal at exactly threshold", () => {
		const manifest = {
			repositories: Array.from({ length: 100 }, (_, i) => ({
				repo: `o/r${i}`,
			})),
		};
		const fetchedSubset = Array.from({ length: 95 }, (_, i) =>
			fetched(`o/r${i}`),
		); // 5 removals = 5%
		const r = reconcile({ manifest, fetched: fetchedSubset, now });
		expect(r.kind).toBe("ok");
	});

	it("allows large removal when override flag set", () => {
		const manifest = {
			repositories: Array.from({ length: 100 }, (_, i) => ({
				repo: `o/r${i}`,
			})),
		};
		const fetchedSubset = Array.from({ length: 50 }, (_, i) =>
			fetched(`o/r${i}`),
		);
		const r = reconcile({
			manifest,
			fetched: fetchedSubset,
			now,
			removalOverride: true,
		});
		expect(r.kind).toBe("ok");
		if (r.kind === "ok") expect(r.stats.total_removed).toBe(50);
	});

	it("default threshold is exactly 0.05", () => {
		expect(DEFAULT_REMOVAL_THRESHOLD).toBe(0.05);
	});
});

describe("reconcile — additions and metadata sync", () => {
	it("appends new repos with the canonical entry shape", () => {
		const manifest = { repositories: [] };
		const r = reconcile({
			manifest,
			fetched: [
				fetched("a/b", {
					description: "Hello",
					language: "TypeScript",
					topics: ["ts", "graph"],
					stargazers_count: 5,
					archived: true,
				}),
			],
			now,
		});
		expect(r.kind).toBe("ok");
		if (r.kind !== "ok") return;
		expect(r.manifest.repositories).toHaveLength(1);
		const entry = r.manifest.repositories[0];
		expect(entry.repo).toBe("a/b");
		expect(entry.categories).toEqual(["unclassified"]);
		expect(entry.archived).toBe(true);
		expect(entry.summary).toBe("Hello");
		expect(entry.github_metadata).toMatchObject({
			language: "TypeScript",
			stargazers_count: 5,
		});
		expect(r.stats.total_new).toBe(1);
		expect(r.stats.changed).toBe(true);
	});

	it("updates last_synced_sha on existing repos when fresh sha differs", () => {
		const manifest = {
			repositories: [
				{
					repo: "a/b",
					last_synced_sha: "0".repeat(40),
					user_starred_at: "2025-01-01T00:00:00Z",
				},
			],
		};
		const r = reconcile({
			manifest,
			fetched: [
				fetched("a/b", {
					last_commit_sha: "b".repeat(40),
					updated_at: "2026-02-01T00:00:00Z",
				}),
			],
			now,
		});
		expect(r.kind).toBe("ok");
		if (r.kind !== "ok") return;
		expect(r.manifest.repositories[0].last_synced_sha).toBe("b".repeat(40));
		expect(r.stats.total_updated).toBe(1);
	});

	it("does NOT mutate input manifest", () => {
		const manifest = {
			repositories: [{ repo: "a/b", last_synced_sha: "0".repeat(40) }],
		};
		const r = reconcile({
			manifest,
			fetched: [fetched("a/b", { last_commit_sha: "b".repeat(40) })],
			now,
		});
		expect(r.kind).toBe("ok");
		expect(manifest.repositories[0].last_synced_sha).toBe("0".repeat(40)); // original unchanged
	});

	it("removes repos no longer starred (under threshold)", () => {
		// 100 manifest repos, 99 still starred → 1% removal, under 5% threshold.
		const manifest = {
			repositories: Array.from({ length: 100 }, (_, i) => ({
				repo: `o/r${i}`,
			})),
		};
		const stillStarred = Array.from({ length: 99 }, (_, i) =>
			fetched(`o/r${i}`),
		);
		const r = reconcile({ manifest, fetched: stillStarred, now });
		expect(r.kind).toBe("ok");
		if (r.kind !== "ok") return;
		expect(r.manifest.repositories.map((rp) => rp.repo)).not.toContain("o/r99");
		expect(r.stats.total_removed).toBe(1);
	});

	it("updates manifest_metadata.github_user when option provided", () => {
		const manifest = {
			repositories: [],
			manifest_metadata: { github_user: "old" },
		};
		const r = reconcile({ manifest, fetched: [], now, githubUser: "primeinc" });
		expect(r.kind).toBe("ok");
		if (r.kind !== "ok") return;
		expect(r.manifest.manifest_metadata?.github_user).toBe("primeinc");
	});
});

describe("cleanDescription", () => {
	it("returns placeholder for empty/whitespace input", () => {
		expect(cleanDescription(undefined)).toBe("No description provided");
		expect(cleanDescription("  ")).toBe("No description provided");
	});
	it("strips leading hashes, splits camelCase, collapses whitespace", () => {
		expect(cleanDescription("# myProject\n\nfooBar")).toBe(
			"my Project foo Bar",
		);
	});
	it("truncates to 200 chars (197 + ellipsis)", () => {
		const long = "X".repeat(500);
		const out = cleanDescription(long);
		expect(out.length).toBe(200);
		expect(out.endsWith("...")).toBe(true);
	});
});
