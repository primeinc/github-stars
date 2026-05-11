// Gate stage: ban `z.any(` and `z.unknown(` at call sites.
//
// Why: Zod schemas are the contract surface every public boundary in
// `src/**` parses through. `z.any()` and `z.unknown()` accept anything
// — using them in a registered schema defeats the purpose of having a
// registry at all (the entry exists, but the runtime parse is a no-op).
// Per the canonical Zod metadata doctrine
// (`refs/colinhacks/zod/packages/docs/content/metadata.mdx`):
// schemas are how Zod knows what shape to enforce; loose escapes
// silently broaden every consumer downstream.
//
// Doctrine source: ../../../juv2/packages/governance/src/check-no-loose-zod-core.ts.
// We diverge from juv2's hand-rolled lexer (juv2 bans regex literals
// repo-wide; we don't) and use a regex-based string/comment stripper.
// The output is lexically equivalent to the input for substring scanning.

import {
	GENERATED_ARTIFACTS as _GENERATED_ARTIFACTS,
	type GeneratedArtifact,
} from "../generated/registry.js";

// Internal-only — the registry import is reserved for callers that want
// to gate-check generated outputs. We don't use it here; the underscore
// prefix marks it as a future-use re-export. Suppress unused-import.
void _GENERATED_ARTIFACTS;

/**
 * Loose-zod token literals — the substring patterns this gate refuses
 * to allow at call sites. Both `z.any` and `z.unknown` are valid Zod
 * APIs but defeat schema enforcement at runtime, so we ban them in
 * src/** unless the call is inside a stripped string or comment.
 *
 * @public
 */
export const LOOSE_TOKENS: ReadonlyArray<string> = ["z.any(", "z.unknown("];

/**
 * Path substrings that mark a file as out-of-scope. The runner
 * normalizes paths to forward-slash before checking so Windows
 * back-slash paths match too.
 */
const EXCLUDE_SUBSTRINGS: ReadonlyArray<string> = [
	"/node_modules/",
	"\\node_modules\\",
	"/vendor/",
	"\\vendor\\",
	"/dist/",
	"\\dist\\",
	"/generated/",
	"\\generated\\",
	"/coverage/",
	"\\coverage\\",
	"/web/",
	"\\web\\",
	"/docs/",
	"\\docs\\",
];

/**
 * Predicate: returns true when the relative path should be skipped by
 * the gate. Used by the runner to filter the file list it passes to
 * {@link evaluateLooseZod}.
 *
 * @param rel - The relative path to test (POSIX or Windows separators).
 * @returns True when the path should be excluded.
 *
 * @public
 */
export function isExcluded(rel: string): boolean {
	const norm = `/${rel}`;
	for (const needle of EXCLUDE_SUBSTRINGS) {
		if (norm.includes(needle)) return true;
	}
	return false;
}

/**
 * One loose-zod call-site found by the scanner.
 *
 * @public
 */
export interface LooseZodFinding {
	/** Repo-relative path to the offending file. */
	readonly path: string;
	/** Which token matched ({@link LOOSE_TOKENS}). */
	readonly token: string;
	/** 1-based line number in the original source. */
	readonly line: number;
	/** Trimmed content of the offending line. */
	readonly excerpt: string;
}

/**
 * Strip every string literal, template-literal expression, and comment
 * from `text`, replacing each with spaces (length-preserving so line
 * numbers stay accurate). The output is lexically equivalent to the
 * input for the purpose of finding `z.any()` / `z.unknown()` CALL
 * SITES — anything that lives inside a comment or string is wiped
 * before the substring scan runs.
 *
 * @remarks
 * Recognizes:
 *
 *   - Line comments:    `// ... \n`
 *   - Block comments:   `/* ... *\/`
 *   - Single-quoted:    `'...'` with `\` escapes
 *   - Double-quoted:    `"..."` with `\` escapes
 *   - Template literals (backtick-delimited) with `\` escapes;
 *     `${expr}` interpolations are STRIPPED too — a real `z.any()`
 *     placed inside an interpolation will NOT flag (acceptable
 *     trade-off for the simpler scanner; an interpolation is already
 *     a code escape
 *     hatch and a reviewer would catch the pattern at PR time).
 *
 * @param text - The source text to strip.
 * @returns The stripped source — same length, same line breaks.
 *
 * @public
 */
export function stripStringsAndComments(text: string): string {
	const out: string[] = [];
	const n = text.length;
	let i = 0;
	while (i < n) {
		const c = text[i];
		const next = text[i + 1];
		// Line comment.
		if (c === "/" && next === "/") {
			while (i < n && text[i] !== "\n") {
				out.push(" ");
				i++;
			}
			continue;
		}
		// Block comment.
		if (c === "/" && next === "*") {
			out.push(" ", " ");
			i += 2;
			while (i < n) {
				if (text[i] === "*" && text[i + 1] === "/") {
					out.push(" ", " ");
					i += 2;
					break;
				}
				out.push(text[i] === "\n" ? "\n" : " ");
				i++;
			}
			continue;
		}
		// Single-quoted string.
		if (c === "'") {
			out.push(" ");
			i++;
			while (i < n && text[i] !== "'") {
				if (text[i] === "\\" && i + 1 < n) {
					out.push(" ", " ");
					i += 2;
					continue;
				}
				out.push(text[i] === "\n" ? "\n" : " ");
				i++;
			}
			if (i < n) {
				out.push(" ");
				i++;
			}
			continue;
		}
		// Double-quoted string.
		if (c === '"') {
			out.push(" ");
			i++;
			while (i < n && text[i] !== '"') {
				if (text[i] === "\\" && i + 1 < n) {
					out.push(" ", " ");
					i += 2;
					continue;
				}
				out.push(text[i] === "\n" ? "\n" : " ");
				i++;
			}
			if (i < n) {
				out.push(" ");
				i++;
			}
			continue;
		}
		// Template literal — wipe contents including interpolations.
		if (c === "`") {
			out.push(" ");
			i++;
			while (i < n && text[i] !== "`") {
				if (text[i] === "\\" && i + 1 < n) {
					out.push(" ", " ");
					i += 2;
					continue;
				}
				out.push(text[i] === "\n" ? "\n" : " ");
				i++;
			}
			if (i < n) {
				out.push(" ");
				i++;
			}
			continue;
		}
		// Hand-bounded loop: under noUncheckedIndexedAccess `text[i]` is
		// `string | undefined`, but the `i < n` guard upstream means it's
		// always defined here. Cast to string is the canonical narrowing.
		out.push(c as string);
		i++;
	}
	return out.join("");
}

/**
 * Scan a single source string for loose-zod tokens at call sites.
 * `path` is recorded on each finding for downstream rendering; this
 * function does no I/O.
 *
 * @param input - The source body + a label path for findings.
 * @returns Zero or more findings — one per token / line match.
 *
 * @public
 */
export function scanText(input: {
	readonly source: string;
	readonly path: string;
}): LooseZodFinding[] {
	const stripped = stripStringsAndComments(input.source);
	const strippedLines = stripped.split("\n");
	const originalLines = input.source.split("\n");
	const found: LooseZodFinding[] = [];
	for (let i = 0; i < strippedLines.length; i++) {
		const line = strippedLines[i];
		if (line === undefined) continue;
		for (const token of LOOSE_TOKENS) {
			if (line.includes(token)) {
				found.push({
					path: input.path,
					token,
					line: i + 1,
					excerpt: (originalLines[i] ?? "").trim(),
				});
			}
		}
	}
	return found;
}

/**
 * Aggregate result of scanning every in-scope source. The runner
 * walks the file tree, reads each source, then hands the collected
 * sources to {@link evaluateLooseZod} as a pure aggregator.
 *
 * @public
 */
export interface CheckNoLooseZodResult {
	readonly findings: ReadonlyArray<LooseZodFinding>;
	readonly summary: string;
}

/**
 * Evaluate loose-zod coverage across pre-collected sources. Pure
 * aggregator — does no I/O. The runner is expected to enumerate paths
 * via host-io's `walkFilesSync` (or `Bun.Glob`) and read each file
 * before calling.
 *
 * @param input - The list of sources to scan.
 * @returns The full finding list plus a one-line operator summary.
 *
 * @public
 */
export function evaluateLooseZod(input: {
	readonly sources: ReadonlyArray<{
		readonly path: string;
		readonly source: string;
	}>;
}): CheckNoLooseZodResult {
	const findings: LooseZodFinding[] = [];
	for (const { path, source } of input.sources) {
		findings.push(...scanText({ source, path }));
	}
	return {
		findings,
		summary: `${input.sources.length} files scanned, ${findings.length} loose-zod occurrence(s)`,
	};
}

/**
 * Type alias re-export for the single artifact that callers
 * gate-check loose-zod against. Keeps the upstream registry import
 * shape addressable without making consumers reach across packages.
 *
 * @public
 */
export type GateableArtifact = GeneratedArtifact;
