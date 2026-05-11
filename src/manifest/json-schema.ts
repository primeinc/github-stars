// JSON-Schema projection of the Zod manifest contract + a compiled
// `\@exodus/schemasafe` parser for boundary validation.
//
// Two layers, one source of truth:
//
//   - Zod schema (./schema.zod.ts) is the runtime contract every TS
//     consumer parses through; ManifestSchema.parse(yaml) is the
//     primary path.
//   - JSON Schema (this file's ManifestJsonSchema constant) is
//     derived from the Zod schema via `z.toJSONSchema()` per the
//     canonical bridge documented at
//     refs/colinhacks/zod/packages/docs/content/json-schema.mdx.
//
// The compiled `parser` from `\@exodus/schemasafe` is a defense-in-depth
// boundary check — it validates a JSON STRING directly without the
// caller having to handle an unvalidated JSON object first (per the
// schemasafe README L60-81 "parser API" recommendation).
//
// Doctrine sources:
//   - refs/colinhacks/zod/packages/docs/content/json-schema.mdx
//   - refs/ExodusMovement/schemasafe/README.md L60-81 (parser API)

import { type Parse, parser } from "@exodus/schemasafe";
import * as z from "zod";
import { ManifestSchema } from "./schema.zod.js";

/**
 * JSON-Schema projection of {@link ManifestSchema}, targeting JSON
 * Schema Draft 2020-12 (Zod's default). The published artifact at
 * `schemas/repos-schema.json` is a byte-stable serialization of this
 * value, written by `src/manifest/schema-codegen.ts`.
 *
 * @remarks
 * Named with the `Schema` suffix per project Zod-naming convention,
 * even though this constant holds the JSON-Schema *value*, not a Zod
 * schema. The eslint-plugin-zod `consistent-schema-var-name` rule
 * does not distinguish; the suffix keeps the rule happy and signals
 * "this is the contract" to readers.
 *
 * @public
 */
export const ManifestJsonSchema = z.toJSONSchema(ManifestSchema, {
	target: "draft-2020-12",
	unrepresentable: "any",
});

let cachedParser: Parse | undefined;

/**
 * Compiled `\@exodus/schemasafe` parser bound to
 * {@link ManifestJsonSchema}. Pure validator + JSON-string parser in
 * one — returns `{ valid: true, value }` on success or
 * `{ valid: false, error, errors }` on failure.
 *
 * @remarks
 * Compiled lazily on first call to keep module-init cost low for the
 * common case where the consumer only needs the Zod schema.
 * Subsequent calls return the cached parser.
 *
 * @returns The compiled schemasafe parser.
 *
 * @public
 */
export function compileManifestParser(): Parse {
	if (!cachedParser) {
		cachedParser = parser(
			// Cast: @exodus/schemasafe's `Schema` type is JSON-Schema-shaped
			// but more permissive than Zod's typed return; runtime is
			// identical. @ts-expect-error wouldn't satisfy the type guard.
			ManifestJsonSchema as unknown as Parameters<typeof parser>[0],
			{
				mode: "default",
				includeErrors: true,
				allErrors: true,
			},
		);
	}
	return cachedParser;
}
