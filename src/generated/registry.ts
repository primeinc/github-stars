// Generated-artifact registry per issue #69 lesson 6: every generated
// artifact has an explicit producer, consumer, commit policy, and
// validation command. The CI gate (src/gate/cli.ts) calls
// `validateRegistry()` to confirm each entry's `path` exists when the
// artifact policy requires it.

/**
 * The three artifact policies recognised by the gate's
 * `validateRegistry` step.
 *
 * @remarks
 * - `committed`  — must exist in git; gate fails if missing.
 * - `artifacted` — workflow artifact only; gate doesn't check.
 * - `ignored`    — gate ignores presence/absence (intentionally
 *                  generated, intentionally not committed).
 *
 * @public
 */
export const ARTIFACT_POLICY = ["committed", "artifacted", "ignored"] as const;

/**
 * Literal-union over {@link ARTIFACT_POLICY}.
 *
 * @public
 */
export type ArtifactPolicy = (typeof ARTIFACT_POLICY)[number];

/**
 * One row in the generated-artifact registry. Captures the producer
 * (workflow or TS module that emits it), consumers (downstream
 * workflows/modules that read it), commit policy, and an optional
 * validator script.
 *
 * @public
 */
export type GeneratedArtifact = {
	/** Stable ID. */
	id: string;
	/** Path relative to repo root, OR a directory glob (ends with '/'). */
	path: string;
	/** Human description. */
	description: string;
	/** What workflow / TS module produces it. */
	producer: string;
	/** Who consumes it. */
	consumers: string[];
	/** committed = required in git; artifacted = workflow artifact only; ignored = expected absent. */
	policy: ArtifactPolicy;
	/** Optional command (npm script name) that validates the artifact. */
	validate?: string;
};

/**
 * Source-of-truth list of every generated artifact in this repo. The
 * gate runner walks this list at the end of each run and confirms
 * every `committed`-policy entry's path exists.
 *
 * @public
 */
export const GENERATED_ARTIFACTS: ReadonlyArray<GeneratedArtifact> = [
  {
    id: 'fetched-stars-graphql',
    path: '.github-stars/data/fetched-stars-graphql.json',
    description: 'Raw fetched stars (output of stage1+stage2 GraphQL pipeline).',
    producer: 'src/fetch/cli.ts (workflow: 01-fetch-stars.yml)',
    consumers: ['src/sync/cli.ts (workflow: 02-sync-stars.yml)'],
    policy: 'committed',
  },
  {
    id: 'repos-manifest',
    path: 'repos.yml',
    description: 'Authoritative manifest: per-repo classification, metadata, taxonomy.',
    producer: 'src/sync/cli.ts (workflow: 02-sync-stars.yml)',
    consumers: [
      'src/manifest/cli-validate.ts',
      '03-classify-repos.yml',
      '04-build-site.yml',
      '05-generate-readmes.yml',
    ],
    policy: 'committed',
    validate: 'validate',
  },
  {
    id: 'web-data-json',
    path: 'web/public/data.json',
    description: 'Public-facing JSON consumed by the web UI.',
    producer: '04-build-site.yml',
    consumers: ['web/'],
    policy: 'committed',
  },
  {
    id: 'docs-readme',
    path: 'README.md',
    description: 'Top-level README rendered from the manifest.',
    producer: '05-generate-readmes.yml',
    consumers: ['repo viewers'],
    policy: 'committed',
  },
  {
    id: 'docs-categories',
    path: 'categories/',
    description: 'Per-category READMEs.',
    producer: '05-generate-readmes.yml',
    consumers: ['repo viewers'],
    policy: 'committed',
  },
  {
    id: 'docs-tags',
    path: 'tags/',
    description: 'Per-tag READMEs.',
    producer: '05-generate-readmes.yml',
    consumers: ['repo viewers'],
    policy: 'committed',
  },
];

/**
 * Outcome of a {@link validateRegistry} run.
 *
 * @public
 */
export type RegistryValidation = {
	ok: boolean;
	missing: string[];
};

/**
 * Walk a registry and confirm every `committed`-policy entry's path
 * exists. Pure function — `fsExists` is injected so tests can pass
 * a stub instead of touching disk.
 *
 * @param fsExists - Predicate: does the path exist on disk?
 * @param artifacts - The registry to validate; defaults to {@link GENERATED_ARTIFACTS}.
 * @returns `ok: true` when nothing is missing; otherwise the list of
 *   `<id> (<path>)` strings for missing committed artifacts.
 *
 * @public
 */
export function validateRegistry(
	fsExists: (p: string) => boolean,
	artifacts: ReadonlyArray<GeneratedArtifact> = GENERATED_ARTIFACTS,
): RegistryValidation {
  const missing: string[] = [];
  for (const a of artifacts) {
    if (a.policy !== 'committed') continue;
    if (!fsExists(a.path)) missing.push(`${a.id} (${a.path})`);
  }
  return { ok: missing.length === 0, missing };
}
