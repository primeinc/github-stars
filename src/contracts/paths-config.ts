// Canonical Zod schema for the repo-relative static-path catalog.
//
// The catalog used to be a hand-rolled tuple + dictionary in src/. Every
// repo-relative literal duplicated across two surfaces. Right shape:
// declare each path once in `github-stars.paths.config.ts` at the repo
// root, validate through THIS registered Zod schema, then derive both
// the tuple AND the dictionary from that single declaration.
//
// Loaded via a static import + a pass-through SyncAdapter in
// `./paths.ts` (NOT `zod-config`'s scriptAdapter — see paths.ts header
// for the `bun build --compile` reason that pins the static-import
// pattern).
//
// Doctrine source: ../../../../juv2/packages/contracts-core/src/paths-config.ts.

import * as z from "zod";
import { registerSchemaById } from "./registry.js";

/**
 * camelCase predicate: lowercase ASCII first char, then ASCII letters /
 * digits. Char-walk, no regex (kept structural for inspectability + so
 * the function survives the no-loose-zod gate's lexer cleanly).
 */
function isCamelCase(s: string): boolean {
	if (s.length === 0) return false;
	const first = s.charCodeAt(0);
	if (first < 0x61 || first > 0x7a) return false;
	for (let i = 1; i < s.length; i += 1) {
		const c = s.charCodeAt(i);
		const isLower = c >= 0x61 && c <= 0x7a;
		const isUpper = c >= 0x41 && c <= 0x5a;
		const isDigit = c >= 0x30 && c <= 0x39;
		if (!(isLower || isUpper || isDigit)) return false;
	}
	return true;
}

/**
 * One entry in the repo-relative static-path catalog. The `key` is
 * the dot-access dictionary name an operator/code uses
 * (`GhStarsPaths.<key>`); the `path` is the literal repo-relative
 * value.
 *
 * @remarks
 * Constraints:
 *
 *   - `key` is camelCase (`[a-z][a-zA-Z0-9]*`).
 *   - `path` is a non-empty repo-relative POSIX path (no leading
 *     `/`, no leading `./`).
 *
 * @public
 */
export const GhStarsPathEntrySchema = registerSchemaById(
	z.strictObject({
		key: z.string().trim().refine(isCamelCase, "key must be camelCase"),
		path: z
			.string()
			.trim()
			.min(1)
			.refine((s) => !s.startsWith("/") && !s.startsWith("./"), {
				error: "path must be repo-relative (no leading `/` or `./`)",
			}),
	}),
	{
		id: "contract.github-stars.paths.entry.v1",
		title: "github-stars Paths — Catalog Entry",
		description:
			"One entry in the repo-relative static-path catalog. Maps a dot-access camelCase key to a repo-relative POSIX path. Single source of truth — the catalog's tuple + dictionary derive from the entries array.",
		owner: "src/contracts/paths-config.ts",
		version: "1.0.0",
		stability: "p1",
	},
);

/**
 * Inferred TS type for {@link GhStarsPathEntrySchema}.
 *
 * @public
 */
export type GhStarsPathEntry = z.infer<typeof GhStarsPathEntrySchema>;

/**
 * Top-level shape of `github-stars.paths.config.ts`. Holds the entries
 * array — every cross-module repo-relative static path lives here.
 *
 * @remarks
 * Two refines run after the strict-object check:
 *
 *   1. Every `key` must be unique across the catalog.
 *   2. Every `path` must be unique across the catalog.
 *
 * Drift surfaces at config load, not deep in a runtime call.
 *
 * @public
 */
export const GhStarsPathsConfigSchema = registerSchemaById(
	z
		.strictObject({
			entries: z.array(GhStarsPathEntrySchema).readonly(),
		})
		.refine(
			(c) => {
				const seen = new Set<string>();
				for (const e of c.entries) {
					if (seen.has(e.key)) return false;
					seen.add(e.key);
				}
				return true;
			},
			{ error: "duplicate key in entries" },
		)
		.refine(
			(c) => {
				const seen = new Set<string>();
				for (const e of c.entries) {
					if (seen.has(e.path)) return false;
					seen.add(e.path);
				}
				return true;
			},
			{ error: "duplicate path in entries" },
		),
	{
		id: "contract.github-stars.paths.config.v1",
		title: "github-stars Paths — Top-Level Config",
		description:
			"Top-level github-stars.paths.config.ts shape. Single source of truth for cross-module repo-relative static paths. The catalog re-exports the derived tuple + dictionary.",
		owner: "src/contracts/paths-config.ts",
		version: "1.0.0",
		stability: "p1",
	},
);

/**
 * Inferred TS type for {@link GhStarsPathsConfigSchema}.
 *
 * @public
 */
export type GhStarsPathsConfig = z.infer<typeof GhStarsPathsConfigSchema>;

/**
 * Identity helper for the config author — gives TS autocomplete +
 * inline schema validation, AND preserves the literal `key` types of
 * every entry (so `typeof inlinedPathsConfig.entries[number]["key"]`
 * is a literal-union rather than a widened `string`). The generic
 * constraint keeps every runtime invariant the schema enforces; the
 * schema-typed return shape is structurally a supertype of the
 * inferred literal one.
 *
 * @example
 * ```ts
 * // github-stars.paths.config.ts
 * import { defineGhStarsPathsConfig } from "./src/contracts/paths-config.js";
 * export default defineGhStarsPathsConfig({
 *   entries: [
 *     { key: "reposManifest", path: "repos.yml" },
 *   ],
 * });
 * ```
 *
 * @public
 */
export function defineGhStarsPathsConfig<const T extends GhStarsPathsConfig>(
	config: T,
): T {
	return config;
}
