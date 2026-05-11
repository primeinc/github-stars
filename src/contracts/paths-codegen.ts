#!/usr/bin/env bun
// Codegen for `generated/paths.json` — the JSON projection of
// `github-stars.paths.config.ts` that non-TS surfaces consume.
//
// TS code reads the catalog directly via
// `import { getGhStarsPath, GhStarsPaths } from "../contracts/paths.js"`.
// Surfaces that cannot import TS (workflow YAML path filters, biome.json
// includes, package.json scripts via jq, shell tooling) read the same
// source of truth from `generated/paths.json`, which this module emits.
//
// Run via `bun run paths:generate` or as a postinstall hook.
// Idempotent: re-running with no config change rewrites byte-identical
// output (atomic, via host-io's writeTextFileAtomicSync).
//
// The output target itself is registered in the catalog as
// `generatedPathsJson` so even this file's destination is not a
// hand-rolled literal.
//
// Doctrine source: ../../../juv2/packages/catalog/src/paths-codegen.ts.

import {
	dirnameOf,
	cwd as hostCwd,
	makeDirSync,
	resolvePath,
	writeStdoutLine,
	writeTextFileAtomicSync,
} from "../host-io/index.js";
import { GhStarsPaths, getGhStarsPath } from "./paths.js";

/**
 * Produce the canonical JSON shape of the path catalog.
 *
 * @remarks
 * The shape is `{ <camelCaseKey>: <repoRelativePath> }`. Stable byte
 * order: keys are emitted in the order declared in
 * `github-stars.paths.config.ts` (which {@link GhStarsPaths}
 * preserves via `Object.fromEntries(entries.map(...))`).
 *
 * @returns The serialized JSON string with a trailing newline.
 *
 * @public
 */
export function renderPathsJson(): string {
	return `${JSON.stringify(GhStarsPaths, null, "\t")}\n`;
}

/**
 * Write `generated/paths.json` to the repo root, resolving from `cwd`.
 *
 * @param cwd - Override for the working directory (the repo root).
 *   Defaults to host-io's `cwd()`.
 * @returns The absolute path that was written.
 *
 * @public
 */
export function writePathsJson(cwd: string = hostCwd()): string {
	const rel = getGhStarsPath("generatedPathsJson");
	const abs = resolvePath(cwd, rel);
	makeDirSync(dirnameOf(abs));
	writeTextFileAtomicSync(abs, renderPathsJson());
	return abs;
}

if (import.meta.main) {
	const written = writePathsJson();
	writeStdoutLine(`wrote ${written}`);
}
