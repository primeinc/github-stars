// Typed schema metadata registry for github-stars contracts.
//
// Two layers, one identity:
//
//   1. GhStarsSchemaRegistry — Zod 4's first-party z.registry(). Schemas
//      attach metadata at definition site via
//      `schema.register(GhStarsSchemaRegistry, meta)`. Forward lookup:
//      `registry.get(schema) → meta`.
//
//   2. SCHEMA_BY_ID — process-local Map<id, { schema, meta }> adding the
//      REVERSE-lookup direction (id → schema). Zod's public registry API
//      only goes one way; this map lets reporter contracts cite a schema
//      by its registered id and have the runtime resolve it back for
//      validation.
//
// Use registerSchemaById(schema, meta) at definition sites. It populates
// BOTH layers, so GhStarsSchemaRegistry.get(schema) and
// resolveSchemaById(id) agree.
//
// Reference: refs/colinhacks/zod/packages/docs/content/metadata.mdx
// Doctrine source: ../../../../juv2/packages/contracts-core/src/registry.ts (verbatim shape).

import * as z from "zod";

/**
 * Metadata shape every github-stars contract attaches when it
 * `.register()`s itself with {@link GhStarsSchemaRegistry}. The `id` is
 * the canonical `contract.github-stars.<area>.<name>.v<n>` string.
 * `stability` gates which contracts may evolve.
 *
 * @public
 */
export type GhStarsSchemaMeta = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly owner: string;
  readonly version: string;
  readonly stability: "p0" | "p1" | "experimental" | "stable" | "deprecated";
};

/**
 * Typed Zod metadata registry shared across every github-stars contract.
 * Schemas attach themselves with `.register(GhStarsSchemaRegistry, meta)`
 * at the definition site; consumers introspect this single registry to
 * discover contract ids.
 *
 * @public
 */
export const GhStarsSchemaRegistry = z.registry<GhStarsSchemaMeta>();

/**
 * A schema entry resolved by id.
 *
 * @public
 */
export interface GhStarsRegisteredSchema {
  readonly id: string;
  readonly schema: z.ZodType;
  readonly meta: GhStarsSchemaMeta;
}

const SCHEMA_BY_ID = new Map<string, GhStarsRegisteredSchema>();

/**
 * Register a schema in BOTH directions: Zod's GhStarsSchemaRegistry AND
 * the local id-keyed map that supports reverse lookup. Returns the
 * schema unchanged so call sites stay one-liners:
 *
 * ```ts
 * export const FooSchema = registerSchemaById(
 *   z.strictObject({ ... }),
 *   { id: "contract.github-stars.foo.v1", title: "Foo", ... },
 * );
 * ```
 *
 * Throws on duplicate id with a different schema instance — drift loud,
 * not silent. Re-registering the SAME schema with the SAME id is a no-op
 * (handles dynamic-import duplication in test runners).
 *
 * @public
 */
export function registerSchemaById<T extends z.ZodType>(
  schema: T,
  meta: GhStarsSchemaMeta,
): T {
  const existing = SCHEMA_BY_ID.get(meta.id);
  if (existing !== undefined && existing.schema !== schema) {
    throw new Error(
      `src/contracts/registry: duplicate schema id '${meta.id}' (already registered with a different schema instance)`,
    );
  }
  if (existing === undefined) {
    (schema as z.ZodType).register(GhStarsSchemaRegistry, meta);
    SCHEMA_BY_ID.set(meta.id, { id: meta.id, schema, meta });
  }
  return schema;
}

/**
 * Reverse lookup: id → registered schema entry. Returns `undefined`
 * when no schema is registered under `id`. Use {@link hasSchemaId} for
 * a boolean-only check.
 *
 * @public
 */
export function resolveSchemaById(
  id: string,
): GhStarsRegisteredSchema | undefined {
  return SCHEMA_BY_ID.get(id);
}

/**
 * Predicate form of {@link resolveSchemaById}.
 *
 * @public
 */
export function hasSchemaId(id: string): boolean {
  return SCHEMA_BY_ID.has(id);
}

/**
 * Snapshot of every schema id currently registered via
 * {@link registerSchemaById}. ASCII-sorted. Surface for invariant tests
 * + diagnostic banners.
 *
 * @public
 */
export function listSchemaIds(): ReadonlyArray<string> {
  return [...SCHEMA_BY_ID.keys()].sort();
}
