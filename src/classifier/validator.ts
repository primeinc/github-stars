// Classifier validation pipeline. Per issue #71, model output is
// CANDIDATE classification, never truth. The validator:
//
//   1. Parses the JSON via ClassifierResponseSchema (strict shape).
//   2. Matches each row against the requested batch (no extras, no
//      mismatched repo names).
//   3. Filters categories against the canonical taxonomy.
//   4. Validates framework against the canonical taxonomy.
//   5. Filters tags against a normalisation pattern.
//   6. Cross-checks language tags (`lang:X`) against gathered repo
//      metadata; mismatches → needs_review.
//   7. Emits a typed `ValidatedClassification` per row + a summary
//      with rejected/needs-review counts.
//
// The reconciler may only consume rows where `decision === "accept"`.
// `decision === "reject"` rows are dropped with a reason. `decision
// === "needs_review"` rows pass-through as classification candidates
// but mark the manifest entry's `needs_review: true`.
//
// Doctrine: this module is pure — no IO, no env reads, no logging.
// The CLI runner (`src/classifier/cli.ts`) handles those.

import {
	canonicalize,
	createCanonicalSet,
	validateFramework,
} from "../manifest/taxonomy.js";
import type { Taxonomy } from "../manifest/types.js";
import {
	type ClassifierResponse,
	ClassifierResponseSchema,
	type ClassifierRow,
} from "./classification-schema.js";

/**
 * Result of validating one classifier row. The `decision` field is
 * the gate: only `accept` rows may mutate the manifest. `reject` and
 * `needs_review` carry a structured `reason` so the workflow summary
 * can surface counts + sample reasons.
 *
 * @public
 */
export interface ValidatedClassification {
	readonly repo: string;
	readonly decision: "accept" | "reject" | "needs_review";
	readonly categories: ReadonlyArray<string>;
	readonly tags: ReadonlyArray<string>;
	readonly framework: string | null;
	readonly reason: string | null;
}

/**
 * Per-repo evidence the model was given (or that the validator can
 * cross-check the model's claims against). Currently used to verify
 * `lang:X` tag claims; expand here as more evidence sources land.
 *
 * @public
 */
export interface RepoEvidence {
	readonly repo: string;
	/** Primary language reported by the GitHub metadata, lowercase. */
	readonly language: string | null;
}

/**
 * Aggregate validation outcome. The CLI runner uses `accepted` to
 * mutate the manifest, surfaces `summary.*Count` in the workflow
 * step summary, and writes `rejectedSamples` to a forensic artifact.
 *
 * @public
 */
export interface ClassifierValidationResult {
	readonly accepted: ReadonlyArray<ValidatedClassification>;
	readonly needsReview: ReadonlyArray<ValidatedClassification>;
	readonly rejected: ReadonlyArray<ValidatedClassification>;
	readonly summary: {
		readonly batchSize: number;
		readonly returnedRowCount: number;
		readonly acceptedCount: number;
		readonly needsReviewCount: number;
		readonly rejectedCount: number;
		readonly missingFromResponse: ReadonlyArray<string>;
		readonly extraInResponse: ReadonlyArray<string>;
	};
}

/**
 * Map of canonical-language → canonical-tag-suffix. Mirrors the
 * alias map embedded in 03-classify-repos.yml so the validator and
 * the prompt builder agree on the same canonical set.
 *
 * @internal
 */
const LANGUAGE_ALIAS: Record<string, string> = {
	javascript: "js",
	typescript: "ts",
	"c++": "cpp",
	"c#": "csharp",
};

const LANG_TAG_PREFIX = "lang:";

/**
 * Tag-format predicate. Equivalent to the regex
 * `/^([a-z]+:)?[a-z0-9][a-z0-9-]*$/` but written as a char-walk to
 * dodge security/detect-unsafe-regex's false positive on the
 * bounded prefix alternation. Same predicate shape as
 * `isValidTag` in src/manifest/validator.ts.
 */
function isValidTagFormat(tag: string): boolean {
	if (tag.length === 0) return false;
	let i = 0;
	// Optional prefix: `lowercase+:` (e.g. `lang:`).
	const colon = tag.indexOf(":");
	if (colon > 0) {
		for (let j = 0; j < colon; j++) {
			const c = tag.charCodeAt(j);
			// 'a'(97) – 'z'(122)
			if (c < 97 || c > 122) return false;
		}
		i = colon + 1;
	} else if (colon === 0) {
		return false; // leading colon
	}
	// Required first body char: lowercase or digit.
	if (i >= tag.length) return false;
	const first = tag.charCodeAt(i);
	const firstOk = (first >= 97 && first <= 122) || (first >= 48 && first <= 57); // a-z | 0-9
	if (!firstOk) return false;
	// Remaining: lowercase, digit, or '-'.
	for (let j = i + 1; j < tag.length; j++) {
		const c = tag.charCodeAt(j);
		const ok = (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 45; // a-z | 0-9 | -
		if (!ok) return false;
	}
	return true;
}

function canonicalLangTagSuffix(language: string | null): string | null {
	if (language === null || language === "") return null;
	const lower = language.toLowerCase();
	return LANGUAGE_ALIAS[lower] ?? lower;
}

function sanitizeTag(raw: string): string {
	return raw
		.toLowerCase()
		.replace(/[^a-z0-9-:]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

function reject(repo: string, reason: string): ValidatedClassification {
	return {
		repo,
		decision: "reject",
		categories: [],
		tags: [],
		framework: null,
		reason,
	};
}

function needsReview(
	repo: string,
	categories: ReadonlyArray<string>,
	tags: ReadonlyArray<string>,
	framework: string | null,
	reason: string,
): ValidatedClassification {
	return {
		repo,
		decision: "needs_review",
		categories,
		tags,
		framework,
		reason,
	};
}

function accept(
	repo: string,
	categories: ReadonlyArray<string>,
	tags: ReadonlyArray<string>,
	framework: string | null,
): ValidatedClassification {
	return {
		repo,
		decision: "accept",
		categories,
		tags,
		framework,
		reason: null,
	};
}

/**
 * Validate one row against the canonical taxonomy + per-repo
 * evidence. Returns the `decision` the row earned.
 *
 * @public
 */
export function validateRow(
	row: ClassifierRow,
	taxonomy: Taxonomy,
	evidence: RepoEvidence | undefined,
): ValidatedClassification {
	const allowedCategories = createCanonicalSet(taxonomy.categories_allowed);
	const safeCategories: string[] = [];
	for (const cat of row.categories) {
		const canon = canonicalize(cat);
		if (allowedCategories.has(canon)) safeCategories.push(canon);
	}
	if (safeCategories.length === 0 && row.categories.length > 0) {
		return reject(
			row.repo,
			`all_categories_unknown: ${row.categories.join(", ")}`,
		);
	}
	if (safeCategories.length === 0) {
		return reject(row.repo, "no_categories_returned");
	}

	const safeTags: string[] = [];
	for (const t of row.tags) {
		const sanitized = sanitizeTag(t);
		if (isValidTagFormat(sanitized)) safeTags.push(sanitized);
	}

	const validFramework = validateFramework(row.framework, taxonomy);

	// Cross-check `lang:X` tags against gathered evidence.
	const expectedLangSuffix = evidence
		? canonicalLangTagSuffix(evidence.language)
		: null;
	const langTags = safeTags.filter((t) => t.startsWith(LANG_TAG_PREFIX));
	const contradictedLang = langTags.find(
		(t) =>
			expectedLangSuffix !== null &&
			t.slice(LANG_TAG_PREFIX.length) !== expectedLangSuffix,
	);
	if (contradictedLang !== undefined) {
		return needsReview(
			row.repo,
			safeCategories,
			safeTags,
			validFramework,
			`lang_tag_contradicted: model emitted ${contradictedLang}, evidence says ${LANG_TAG_PREFIX}${expectedLangSuffix ?? "(none)"}`,
		);
	}

	return accept(row.repo, safeCategories, safeTags, validFramework);
}

/**
 * Validate a parsed classifier response against the requested batch
 * and the canonical taxonomy.
 *
 * @public
 */
export function validateResponse(args: {
	readonly response: ClassifierResponse;
	readonly batchRepos: ReadonlyArray<string>;
	readonly taxonomy: Taxonomy;
	readonly evidence: ReadonlyArray<RepoEvidence>;
}): ClassifierValidationResult {
	const { response, batchRepos, taxonomy, evidence } = args;
	const requested = new Set(batchRepos);
	const responded = new Set<string>();
	const evidenceByRepo = new Map(evidence.map((e) => [e.repo, e] as const));

	const accepted: ValidatedClassification[] = [];
	const needsReviewArr: ValidatedClassification[] = [];
	const rejected: ValidatedClassification[] = [];
	const extras: string[] = [];

	for (const row of response) {
		responded.add(row.repo);
		if (!requested.has(row.repo)) {
			extras.push(row.repo);
			rejected.push(reject(row.repo, "extra_repo_not_in_batch"));
			continue;
		}
		const validated = validateRow(row, taxonomy, evidenceByRepo.get(row.repo));
		if (validated.decision === "accept") accepted.push(validated);
		else if (validated.decision === "needs_review")
			needsReviewArr.push(validated);
		else rejected.push(validated);
	}

	const missing: string[] = [];
	for (const repo of batchRepos) {
		if (!responded.has(repo)) missing.push(repo);
	}

	return {
		accepted,
		needsReview: needsReviewArr,
		rejected,
		summary: {
			batchSize: batchRepos.length,
			returnedRowCount: response.length,
			acceptedCount: accepted.length,
			needsReviewCount: needsReviewArr.length,
			rejectedCount: rejected.length,
			missingFromResponse: missing,
			extraInResponse: extras,
		},
	};
}

/**
 * Parse + validate a raw model output string. Returns either a
 * structured validation result or a `parseError`. Callers must NEVER
 * pass a string that didn't come straight from the model — the
 * sanitisers (markdown fences, trailing-comma fixes) live in the CLI
 * runner so the validation layer stays pure.
 *
 * @public
 */
export function parseAndValidate(args: {
	readonly raw: string;
	readonly batchRepos: ReadonlyArray<string>;
	readonly taxonomy: Taxonomy;
	readonly evidence: ReadonlyArray<RepoEvidence>;
}):
	| { ok: true; result: ClassifierValidationResult }
	| { ok: false; reason: string } {
	let parsed: unknown;
	try {
		parsed = JSON.parse(args.raw);
	} catch (err) {
		return {
			ok: false,
			reason: `invalid_json: ${err instanceof Error ? err.message : String(err)}`,
		};
	}
	const schemaResult = ClassifierResponseSchema.safeParse(parsed);
	if (!schemaResult.success) {
		return {
			ok: false,
			reason: `schema_violation: ${schemaResult.error.issues
				.slice(0, 3)
				.map((i) => `${i.path.join(".")}: ${i.message}`)
				.join("; ")}`,
		};
	}
	return {
		ok: true,
		result: validateResponse({
			response: schemaResult.data,
			batchRepos: args.batchRepos,
			taxonomy: args.taxonomy,
			evidence: args.evidence,
		}),
	};
}
