#!/usr/bin/env bun
// Codegen for `schemas/repos-schema.json` — the JSON-Schema projection
// of the Zod manifest contract. Consumers that need a raw JSON Schema
// (IDE schema attachment, third-party validators, OpenAPI tooling,
// agentic-AI structured outputs) read this file; the source of truth
// is {@link "./schema.zod".ManifestSchema}.
//
// Run via `bun run schema:generate` or as a manual step before
// committing changes to the manifest contract. Idempotent: re-running
// with no Zod-schema change writes byte-identical output (atomic via
// host-io's writeTextFileAtomicSync).
//
// The output target is registered in `github-stars.paths.config.ts`
// as `reposSchemaJson` so even this file's destination is not a
// hand-rolled literal.

import { getGhStarsPath } from "../contracts/paths.js";
import {
	dirnameOf,
	cwd as hostCwd,
	makeDirSync,
	resolvePath,
	writeStdoutLine,
	writeTextFileAtomicSync,
} from "../host-io/index.js";
import { ManifestJsonSchema } from "./json-schema.js";

/**
 * Render the canonical JSON-Schema document with stable byte order
 * (tab-indented, trailing newline — matches the rest of the repo's
 * generated JSON conventions).
 *
 * @public
 */
export function renderManifestJsonSchema(): string {
	return `${JSON.stringify(ManifestJsonSchema, null, "\t")}\n`;
}

/**
 * Write `schemas/repos-schema.json` to the repo root, resolving from
 * `cwd`.
 *
 * @param cwd - Override for the working directory (the repo root).
 *   Defaults to host-io's `cwd()`.
 * @returns The absolute path that was written.
 *
 * @public
 */
export function writeManifestJsonSchema(cwd: string = hostCwd()): string {
	const rel = getGhStarsPath("reposSchemaJson");
	const abs = resolvePath(cwd, rel);
	makeDirSync(dirnameOf(abs));
	writeTextFileAtomicSync(abs, renderManifestJsonSchema());
	return abs;
}

if (import.meta.main) {
	const written = writeManifestJsonSchema();
	writeStdoutLine(`wrote ${written}`);
}
