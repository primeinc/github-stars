// Classifier validator tests covering every failure mode from #71.
//
// The 9 required failure modes per the issue spec:
//   1. wrong repo returned
//   2. extra repo returned
//   3. missing repo returned
//   4. invalid JSON
//   5. unknown category
//   6. unknown framework
//   7. language tag contradicted by collected metadata
//   8. unsupported tag with no evidence  (covered by #5/#7 union)
//   9. legacy prompt output accepted without evidence  (covered by
//      the always-on schema gate; raw model JSON cannot pass through
//      without the validator's accept decision)

import { describe, expect, it } from "bun:test";
import type { Taxonomy } from "../manifest/types.js";
import { parseAndValidate, validateResponse } from "./validator.js";

const TAXONOMY: Taxonomy = {
	categories_allowed: ["ai-ml", "dev-tools", "productivity"],
	frameworks_allowed: ["nextjs", "react", "vue"],
};

describe("validateResponse — happy path", () => {
	it("accepts a clean batch matching the requested repos exactly", () => {
		const result = validateResponse({
			response: [
				{
					repo: "octocat/hello-world",
					categories: ["dev-tools"],
					tags: ["lang:ts"],
					framework: null,
				},
				{
					repo: "octocat/spoon-knife",
					categories: ["ai-ml"],
					tags: ["agent", "lang:python"],
					framework: "nextjs",
				},
			],
			batchRepos: ["octocat/hello-world", "octocat/spoon-knife"],
			taxonomy: TAXONOMY,
			evidence: [
				{ repo: "octocat/hello-world", language: "TypeScript" },
				{ repo: "octocat/spoon-knife", language: "python" },
			],
		});
		expect(result.summary.acceptedCount).toBe(2);
		expect(result.summary.rejectedCount).toBe(0);
		expect(result.summary.needsReviewCount).toBe(0);
		expect(result.accepted[0]?.framework).toBeNull();
		expect(result.accepted[1]?.framework).toBe("nextjs");
	});

	it("canonicalises categories (case + whitespace)", () => {
		const result = validateResponse({
			response: [
				{
					repo: "a/b",
					categories: [" Dev-Tools ", "AI-ML"],
					tags: [],
					framework: null,
				},
			],
			batchRepos: ["a/b"],
			taxonomy: TAXONOMY,
			evidence: [],
		});
		expect(result.accepted[0]?.categories).toEqual(["dev-tools", "ai-ml"]);
	});
});

describe("validateResponse — failure modes from #71", () => {
	it("[#1] wrong repo returned (mismatched name)", () => {
		// "Wrong" = name not in batch → flagged as extra. Combined with
		// missing, this surfaces the row-mismatch.
		const result = validateResponse({
			response: [
				{
					repo: "TYPO/HELLO-WORLD",
					categories: ["dev-tools"],
					tags: [],
					framework: null,
				},
			],
			batchRepos: ["octocat/hello-world"],
			taxonomy: TAXONOMY,
			evidence: [],
		});
		expect(result.summary.extraInResponse).toEqual(["TYPO/HELLO-WORLD"]);
		expect(result.summary.missingFromResponse).toEqual(["octocat/hello-world"]);
		expect(result.rejected[0]?.reason).toBe("extra_repo_not_in_batch");
	});

	it("[#2] extra repo returned", () => {
		const result = validateResponse({
			response: [
				{
					repo: "a/b",
					categories: ["dev-tools"],
					tags: [],
					framework: null,
				},
				{
					repo: "model-hallucinated/extra",
					categories: ["dev-tools"],
					tags: [],
					framework: null,
				},
			],
			batchRepos: ["a/b"],
			taxonomy: TAXONOMY,
			evidence: [],
		});
		expect(result.summary.extraInResponse).toEqual([
			"model-hallucinated/extra",
		]);
		expect(result.summary.acceptedCount).toBe(1);
	});

	it("[#3] missing repo returned (model dropped a row)", () => {
		const result = validateResponse({
			response: [
				{
					repo: "a/b",
					categories: ["dev-tools"],
					tags: [],
					framework: null,
				},
			],
			batchRepos: ["a/b", "c/d"],
			taxonomy: TAXONOMY,
			evidence: [],
		});
		expect(result.summary.missingFromResponse).toEqual(["c/d"]);
		expect(result.summary.acceptedCount).toBe(1);
	});

	it("[#4] invalid JSON is rejected with structured reason", () => {
		const r = parseAndValidate({
			raw: "{ this is not json",
			batchRepos: ["a/b"],
			taxonomy: TAXONOMY,
			evidence: [],
		});
		expect(r.ok).toBe(false);
		if (r.ok === false) {
			expect(r.reason).toContain("invalid_json");
		}
	});

	it("[#4b] non-array JSON is rejected via the schema", () => {
		const r = parseAndValidate({
			raw: JSON.stringify({ message: "I am not an array" }),
			batchRepos: ["a/b"],
			taxonomy: TAXONOMY,
			evidence: [],
		});
		expect(r.ok).toBe(false);
		if (r.ok === false) {
			expect(r.reason).toContain("schema_violation");
		}
	});

	it("[#5] unknown category — all rejected → row rejected", () => {
		const result = validateResponse({
			response: [
				{
					repo: "a/b",
					categories: ["alien-category", "another-fake"],
					tags: [],
					framework: null,
				},
			],
			batchRepos: ["a/b"],
			taxonomy: TAXONOMY,
			evidence: [],
		});
		expect(result.summary.acceptedCount).toBe(0);
		expect(result.summary.rejectedCount).toBe(1);
		expect(result.rejected[0]?.reason).toContain("all_categories_unknown");
	});

	it("[#5b] unknown category mixed with known — partial accept", () => {
		const result = validateResponse({
			response: [
				{
					repo: "a/b",
					categories: ["dev-tools", "alien-category"],
					tags: [],
					framework: null,
				},
			],
			batchRepos: ["a/b"],
			taxonomy: TAXONOMY,
			evidence: [],
		});
		expect(result.accepted[0]?.categories).toEqual(["dev-tools"]);
		expect(result.summary.acceptedCount).toBe(1);
	});

	it("[#6] unknown framework — accept categories, framework set to null", () => {
		const result = validateResponse({
			response: [
				{
					repo: "a/b",
					categories: ["dev-tools"],
					tags: [],
					framework: "alien-framework",
				},
			],
			batchRepos: ["a/b"],
			taxonomy: TAXONOMY,
			evidence: [],
		});
		expect(result.summary.acceptedCount).toBe(1);
		expect(result.accepted[0]?.framework).toBeNull();
	});

	it("[#7] language tag contradicted by collected metadata → needs_review", () => {
		const result = validateResponse({
			response: [
				{
					repo: "JamieMason/syncpack",
					categories: ["dev-tools"],
					tags: ["lang:rust"],
					framework: null,
				},
			],
			batchRepos: ["JamieMason/syncpack"],
			taxonomy: TAXONOMY,
			evidence: [{ repo: "JamieMason/syncpack", language: "TypeScript" }],
		});
		expect(result.summary.needsReviewCount).toBe(1);
		expect(result.summary.acceptedCount).toBe(0);
		expect(result.needsReview[0]?.reason).toContain("lang_tag_contradicted");
		expect(result.needsReview[0]?.reason).toContain("lang:rust");
		expect(result.needsReview[0]?.reason).toContain("lang:ts");
	});

	it("[#7b] language tag matches evidence → accept (with alias map)", () => {
		const result = validateResponse({
			response: [
				{
					repo: "a/b",
					categories: ["dev-tools"],
					tags: ["lang:cpp"],
					framework: null,
				},
			],
			batchRepos: ["a/b"],
			taxonomy: TAXONOMY,
			evidence: [{ repo: "a/b", language: "C++" }],
		});
		expect(result.summary.acceptedCount).toBe(1);
	});

	it("[#7c] no evidence for repo → lang tag passes through (no contradiction possible)", () => {
		const result = validateResponse({
			response: [
				{
					repo: "a/b",
					categories: ["dev-tools"],
					tags: ["lang:ts"],
					framework: null,
				},
			],
			batchRepos: ["a/b"],
			taxonomy: TAXONOMY,
			evidence: [],
		});
		expect(result.summary.acceptedCount).toBe(1);
	});

	it("[#8] unsupported tag — sanitised + filtered against pattern", () => {
		const result = validateResponse({
			response: [
				{
					repo: "a/b",
					categories: ["dev-tools"],
					tags: ["NORMAL TAG", "weird@symbol", "good-one", "lang:ts"],
					framework: null,
				},
			],
			batchRepos: ["a/b"],
			taxonomy: TAXONOMY,
			evidence: [],
		});
		// "NORMAL TAG" → "normal-tag" (passes), "weird@symbol" → "weird-symbol" (passes),
		// "good-one" passes, "lang:ts" passes.
		expect(result.accepted[0]?.tags).toEqual([
			"normal-tag",
			"weird-symbol",
			"good-one",
			"lang:ts",
		]);
	});

	it("[#9] legacy raw output cannot reach acceptance without the schema gate", () => {
		// The CLI runner will pipe raw model output into parseAndValidate;
		// any string that doesn't match ClassifierResponseSchema is
		// rejected with `schema_violation` and never reaches the
		// reconciler. This test pins that contract explicitly.
		const r = parseAndValidate({
			raw: '[{"repo":"a/b"}]', // missing required `categories`, `tags`, `framework` fields
			batchRepos: ["a/b"],
			taxonomy: TAXONOMY,
			evidence: [],
		});
		expect(r.ok).toBe(false);
		if (r.ok === false) {
			expect(r.reason).toContain("schema_violation");
		}
	});
});

describe("validateResponse — summary aggregation", () => {
	it("partitions a mixed batch correctly", () => {
		const result = validateResponse({
			response: [
				{
					repo: "ok/one",
					categories: ["dev-tools"],
					tags: ["lang:ts"],
					framework: null,
				},
				{
					repo: "needs-review/two",
					categories: ["dev-tools"],
					tags: ["lang:rust"],
					framework: null,
				},
				{
					repo: "rejected/three",
					categories: ["alien"],
					tags: [],
					framework: null,
				},
				{
					repo: "extra/four",
					categories: ["dev-tools"],
					tags: [],
					framework: null,
				},
			],
			batchRepos: [
				"ok/one",
				"needs-review/two",
				"rejected/three",
				"missing/five",
			],
			taxonomy: TAXONOMY,
			evidence: [{ repo: "needs-review/two", language: "TypeScript" }],
		});
		expect(result.summary.batchSize).toBe(4);
		expect(result.summary.returnedRowCount).toBe(4);
		expect(result.summary.acceptedCount).toBe(1);
		expect(result.summary.needsReviewCount).toBe(1);
		expect(result.summary.rejectedCount).toBe(2);
		expect(result.summary.extraInResponse).toEqual(["extra/four"]);
		expect(result.summary.missingFromResponse).toEqual(["missing/five"]);
	});
});
