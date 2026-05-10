// Repo-relative static path catalog — the typed surface every src/**
// consumer reaches for instead of writing literal path strings.
//
// Loads the single source of truth from `github-stars.paths.config.ts`
// at the repo root via a static ESM import + a sync `loadConfigSync`
// pass-through adapter, validates against the registered
// `GhStarsPathsConfigSchema`, and DERIVES (not generates):
//
//   - `GH_STARS_PATHS`     readonly tuple of literal path strings
//   - `GhStarsPathSchema`  Zod enum over the tuple
//   - `GhStarsPath`        inferred TS literal-union of path values
//   - `GhStarsPathKey`     literal-union of catalog keys, derived via
//                          `<const T extends ...>` from the static-imported
//                          config
//   - `GhStarsPaths`       dot-access dictionary keyed by `GhStarsPathKey`
//   - `getGhStarsPath`     typed accessor with throw-on-miss semantics
//
// "Derived, not generated" — there is no `.generated.ts` artifact
// shipped from this module. The literal-union flows through TS-only
// generic propagation. Non-TS consumers read the projection at
// `generated/paths.json` (emitted by `paths-codegen.ts`).
//
// NO literal path strings appear in this file. Adding a path = one
// entry in `github-stars.paths.config.ts`.
//
// Why static import + pass-through adapter (NOT scriptAdapter):
//
//   - `zod-config`'s scriptAdapter does `await import(<runtime variable
//     specifier>)`
//     (refs/alexmarqs/zod-config/src/lib/adapters/script-adapter/index.ts:21).
//     Bun's bundler can only trace static-string specifiers
//     (refs/oven-sh/bun/docs/bundler/executables.mdx:1139), so the
//     scriptAdapter variant breaks `bun build --compile` — the bundled
//     binary's runtime `import()` walks an absolute path that exists
//     on the dev box but not in the relocated VFS.
//   - The static import below is rewritten by the bundler into the
//     compile output, so the bundle is self-contained.
//   - Validation still runs through the registered schema via
//     `loadConfigSync` + a 3-line pass-through `SyncAdapter`.
//
// Doctrine source: ../../../juv2/packages/catalog/src/paths.ts.

import * as z from "zod";
import { loadConfigSync } from "zod-config";
import inlinedPathsConfig from "../../github-stars.paths.config.js";
import {
	type GhStarsPathsConfig,
	GhStarsPathsConfigSchema,
} from "./paths-config.js";

const config: GhStarsPathsConfig = loadConfigSync({
	schema: GhStarsPathsConfigSchema,
	adapters: [
		{
			name: "static-import-adapter",
			read: () => inlinedPathsConfig as unknown as Record<string, unknown>,
		},
	],
});

// Typed path surface DERIVED (not generated) from the config. The
// config exports a literal-typed object via
// `defineGhStarsPathsConfig<const T extends GhStarsPathsConfig>(c: T): T`
// which preserves each entry's `key` as a string literal type instead
// of widening to `string`. Those literals flow through the type
// extractions below into `GhStarsPathKey`.
//
// Why derivation, not generation:
//   - One source of truth (the config). No physical `.generated.ts`
//     that can drift if a generator step is forgotten.
//   - Non-TS consumers (workflow YAML path filters, biome.json
//     includes, package.json scripts via jq) read the projection at
//     `generated/paths.json` produced by `paths-codegen.ts`.
type InlinedConfig = typeof inlinedPathsConfig;
type InlinedEntries = InlinedConfig extends { entries: infer E } ? E : never;
type InlinedEntry = InlinedEntries extends ReadonlyArray<infer X> ? X : never;

/**
 * Literal-union of every camelCase key declared in
 * `github-stars.paths.config.ts`. New paths are added by appending to
 * the config's `entries` array; this union widens automatically.
 *
 * @public
 */
export type GhStarsPathKey = InlinedEntry extends { key: infer K } ? K : never;

/**
 * Source-of-truth tuple for every cross-module repo-relative static
 * path declared in the catalog. Iterate when you need every path
 * (e.g. for a glob ignore list or an existence sweep).
 *
 * @public
 */
export const GH_STARS_PATHS: ReadonlyArray<string> = config.entries.map(
	(e) => e.path,
);

/**
 * Zod runtime validator: parses a string as one of the known catalog
 * paths; rejects everything else. Use at boundaries where an external
 * input might claim to be a known repo-relative path.
 *
 * @public
 */
export const GhStarsPathSchema = z.enum(
	GH_STARS_PATHS as [string, ...string[]],
);

/**
 * Inferred TS literal-union of every recognized path value.
 *
 * @public
 */
export type GhStarsPath = z.infer<typeof GhStarsPathSchema>;

/**
 * Bracket-access dictionary derived from the config's entries. Keys
 * are statically the literal-union {@link GhStarsPathKey} (no
 * widening to `string`); values are repo-relative paths.
 *
 * @remarks
 * Use {@link getGhStarsPath} when the caller needs a guaranteed
 * `string` and the throw-on-miss semantics; bracket access via this
 * dictionary returns `string | undefined` under
 * `noUncheckedIndexedAccess`.
 *
 * @public
 */
export const GhStarsPaths: Readonly<Record<GhStarsPathKey, string>> =
	Object.freeze(
		Object.fromEntries(config.entries.map((e) => [e.key, e.path])),
	) as Readonly<Record<GhStarsPathKey, string>>;

/**
 * Returns the repo-relative path registered under `key`, or throws
 * if the config does not declare it.
 *
 * @remarks
 * The signature accepts only {@link GhStarsPathKey}, the literal-union
 * derived from `github-stars.paths.config.ts`. Typos and removed
 * entries fail at compile time, not at runtime. The throw remains as
 * defense-in-depth for non-TS callers that bypass the type system.
 *
 * Use bracket access ({@link GhStarsPaths}`[key]`) when an absent
 * key is a valid outcome; that path returns `string | undefined`
 * under `noUncheckedIndexedAccess`.
 *
 * @param key - The camelCase entry key as declared in the config.
 * @returns The literal repo-relative path string registered under `key`.
 * @throws Error when `key` is not declared in the config (defense-in-depth
 *   for non-TS callers).
 *
 * @public
 */
export function getGhStarsPath(key: GhStarsPathKey): string {
	const value = GhStarsPaths[key];
	if (value === undefined) {
		throw new Error(
			`Missing github-stars path: ${key} (declared in github-stars.paths.config.ts?)`,
		);
	}
	return value;
}
