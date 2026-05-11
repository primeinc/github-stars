// Output-repository visibility policy.
//
// `github-stars` deploys its catalog from a public repository to
// public GitHub Pages. Per issue #74, the invariant is:
//
//   If output_repository.visibility == public:
//     private_repository_records MUST NOT be surfaced.
//
// This module is the policy boundary. Workflows and CLIs that emit
// repo identifiers, classifier inputs, summaries, or artifacts call
// `assertPublicSafeBatch()` before any externally-visible write.
//
// Doctrine: telemetry is observability ONLY (see ../telemetry/). This
// module is the dual contract — *visibility safety is enforcement*,
// not an observation. A failure here aborts the pipeline; it does not
// merely log.

import * as z from "zod";
import { GhStarsSchemaRegistry } from "../contracts/registry.js";

/**
 * Output repository visibility states the policy resolver understands.
 * `unknown` is treated as `public` for fail-closed semantics — when
 * we cannot determine visibility, we assume the strictest surface.
 *
 * @public
 */
export const OUTPUT_VISIBILITY = ["public", "private", "unknown"] as const;

/**
 * Zod literal-union of {@link OUTPUT_VISIBILITY}.
 *
 * @public
 */
export const OutputVisibilitySchema = z
	.enum(OUTPUT_VISIBILITY)
	.register(GhStarsSchemaRegistry, {
		id: "contract.github-stars.privacy.output-visibility.v1",
		title: "github-stars Output Visibility",
		description:
			"Tri-state visibility of the repository receiving github-stars output. `unknown` is treated as `public` for fail-closed semantics.",
		owner: "src/privacy/output-visibility.ts",
		version: "1.0.0",
		stability: "p1",
	});

/**
 * Parsed output visibility.
 *
 * @public
 */
export type OutputVisibility = z.infer<typeof OutputVisibilitySchema>;

/**
 * Sentinel slug — a known-private repo identifier the test suite
 * uses to verify no public-mode surface ever emits private data. If
 * this string appears in any artifact, summary, log, or prompt
 * produced by a public-mode run, the leak test must fail.
 *
 * Per issue #74's required test: "Add at least one forbidden
 * sentinel fixture: owner/private-sentinel-repo-do-not-leak."
 *
 * @public
 */
export const PRIVATE_SENTINEL_SLUG =
	"owner/private-sentinel-repo-do-not-leak" as const;

/**
 * Aggregate omission report. Public-mode workflow summaries may emit
 * the count but never the per-repo identifiers. Per issue #74:
 *
 *   Allowed: `private_repos_omitted: 12`
 *   Forbidden: `private_repos_omitted: [owner/private-repo, ...]`
 *
 * @public
 */
export const PrivateOmissionReportSchema = z
	.strictObject({
		count: z.int().nonnegative(),
	})
	.register(GhStarsSchemaRegistry, {
		id: "contract.github-stars.privacy.omission-report.v1",
		title: "github-stars Private Omission Report",
		description:
			"Aggregate count of private repos quarantined from a public-mode run. Per session-oracle verdict rule 8 + issue #74, identifiers are NEVER part of this surface.",
		owner: "src/privacy/output-visibility.ts",
		version: "1.0.0",
		stability: "p1",
	});

/**
 * Aggregate omission report shape.
 *
 * @public
 */
export type PrivateOmissionReport = z.infer<typeof PrivateOmissionReportSchema>;
