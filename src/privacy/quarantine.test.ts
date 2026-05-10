// Privacy quarantine tests — sentinel leak tripwire per issue #74.
//
// The single most important assertion in this file is that the
// PRIVATE_SENTINEL_SLUG never appears in the kept-records or in any
// candidate string passed through assertNoPrivateLeak under public
// mode. If that ever fails, a private repo identifier could leak to
// a public surface.

import { describe, expect, it } from "bun:test";
import { PRIVATE_SENTINEL_SLUG } from "./private-quarantine.js";
import {
	assertNoPrivateLeak,
	findPrivateSlugLeaks,
	PrivateLeakError,
	publicSafeOmissionReport,
	quarantinePrivate,
} from "./quarantine.js";

const SENTINELS = [PRIVATE_SENTINEL_SLUG] as const;

describe("quarantinePrivate", () => {
	it("public mode drops every private record and surfaces aggregate count only", () => {
		const result = quarantinePrivate({
			visibility: "public",
			batch: [
				{ repo: "octocat/hello-world", private: false },
				{ repo: PRIVATE_SENTINEL_SLUG, private: true },
				{ repo: "octocat/spoon-knife" },
				{ repo: "secret-org/internal-thing", private: true },
			],
		});
		expect(result.kept.map((r) => r.repo)).toEqual([
			"octocat/hello-world",
			"octocat/spoon-knife",
		]);
		expect(result.omittedCount).toBe(2);
		// omittedSlugs is RETAINED for tests + internal diagnostics, but
		// the public-safe report MUST NOT carry it forward.
		expect(result.omittedSlugs).toEqual([
			PRIVATE_SENTINEL_SLUG,
			"secret-org/internal-thing",
		]);
	});

	it("private mode passes private records through unchanged", () => {
		const batch = [
			{ repo: "octocat/hello-world", private: false },
			{ repo: PRIVATE_SENTINEL_SLUG, private: true },
		];
		const result = quarantinePrivate({ visibility: "private", batch });
		expect(result.kept).toEqual(batch);
		expect(result.omittedCount).toBe(0);
		expect(result.omittedSlugs).toEqual([]);
	});

	it("unknown visibility fails closed (treated as public)", () => {
		const result = quarantinePrivate({
			visibility: "unknown",
			batch: [
				{ repo: "octocat/hello-world", private: false },
				{ repo: PRIVATE_SENTINEL_SLUG, private: true },
			],
		});
		expect(result.kept.map((r) => r.repo)).toEqual(["octocat/hello-world"]);
		expect(result.omittedCount).toBe(1);
	});

	it("treats missing `private` field as public (fetch path normalizes)", () => {
		// FetchedRepo always sets `private`; this guards against future
		// shapes where the field is optional.
		const result = quarantinePrivate({
			visibility: "public",
			batch: [{ repo: "octocat/hello-world" }],
		});
		expect(result.kept.map((r) => r.repo)).toEqual(["octocat/hello-world"]);
		expect(result.omittedCount).toBe(0);
	});
});

describe("publicSafeOmissionReport", () => {
	it("emits count only, never slugs", () => {
		const report = publicSafeOmissionReport({ omittedCount: 7 });
		expect(report).toEqual({ count: 7 });
		// Verify the report has no slugs field even by accident.
		expect(Object.keys(report)).toEqual(["count"]);
	});
});

describe("findPrivateSlugLeaks", () => {
	it("returns empty when no slugs appear", () => {
		const found = findPrivateSlugLeaks(
			"workflow run completed: 2612 repos classified",
			SENTINELS,
		);
		expect(found).toEqual([]);
	});

	it("returns matched slugs in order of first appearance", () => {
		const text = `Skipped private repo ${PRIVATE_SENTINEL_SLUG} during sync. Also skipped ${PRIVATE_SENTINEL_SLUG} on retry.`;
		const found = findPrivateSlugLeaks(text, SENTINELS);
		expect(found).toEqual([PRIVATE_SENTINEL_SLUG]);
	});

	it("matches each slug independently", () => {
		const slugs = [PRIVATE_SENTINEL_SLUG, "other/private-thing"];
		const text = `Found ${PRIVATE_SENTINEL_SLUG} and other/private-thing in batch`;
		const found = findPrivateSlugLeaks(text, slugs);
		expect(found).toEqual(slugs);
	});
});

describe("assertNoPrivateLeak — sentinel tripwire", () => {
	it("returns void when text is clean", () => {
		expect(() =>
			assertNoPrivateLeak(
				"public summary: 42 repos classified",
				SENTINELS,
				"workflow-summary",
			),
		).not.toThrow();
	});

	it("throws PrivateLeakError when sentinel appears", () => {
		expect(() =>
			assertNoPrivateLeak(
				`Classified ${PRIVATE_SENTINEL_SLUG} as ai-ml`,
				SENTINELS,
				"classifier-output",
			),
		).toThrow(PrivateLeakError);
	});

	it("error names the surface and the leaked slug", () => {
		try {
			assertNoPrivateLeak(
				`leak in artifact: ${PRIVATE_SENTINEL_SLUG}`,
				SENTINELS,
				"docs/data.json",
			);
			throw new Error("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(PrivateLeakError);
			const leakErr = err as PrivateLeakError;
			expect(leakErr.context).toBe("docs/data.json");
			expect(leakErr.leakedSlugs).toEqual([PRIVATE_SENTINEL_SLUG]);
			expect(leakErr.message).toContain("docs/data.json");
			expect(leakErr.message).toContain(PRIVATE_SENTINEL_SLUG);
		}
	});

	it("guards JSON artifact serialisation (sentinel embedded as quoted slug)", () => {
		const artifact = JSON.stringify({
			repositories: [
				{ repo: "octocat/hello-world" },
				{ repo: PRIVATE_SENTINEL_SLUG },
			],
		});
		expect(() =>
			assertNoPrivateLeak(artifact, SENTINELS, "artifact-json"),
		).toThrow(PrivateLeakError);
	});

	it("guards markdown summary surfaces", () => {
		const summary = `## Sync\n\n- Total: 100\n- Skipped: ${PRIVATE_SENTINEL_SLUG}`;
		expect(() =>
			assertNoPrivateLeak(summary, SENTINELS, "GITHUB_STEP_SUMMARY"),
		).toThrow(PrivateLeakError);
	});

	it("guards classifier prompt construction", () => {
		const prompt = `Classify: ${JSON.stringify([{ repo: PRIVATE_SENTINEL_SLUG }])}`;
		expect(() =>
			assertNoPrivateLeak(prompt, SENTINELS, "classifier-prompt"),
		).toThrow(PrivateLeakError);
	});
});
