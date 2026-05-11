// Typed schema for one classifier output row + the response array.
// Per issue #71 the doctrine is: model output is CANDIDATE data, not
// truth. Every claim must pass through this schema before it can
// mutate repos.yml.
//
// The shape mirrors what 03-classify-repos.yml's "AI classify" step
// requests in the system prompt — categories array, tags array,
// optional framework — but adds Zod-strict parsing so a malformed
// model response fails at the boundary instead of deep in the
// reconciler.

import * as z from "zod";
import { GhStarsSchemaRegistry } from "../contracts/registry.js";

/**
 * One classification row produced by the model. The reconciler treats
 * this as untrusted input — see `./validator.ts` for the validation
 * pipeline that filters/rejects each field against the canonical
 * taxonomy and the gathered evidence.
 *
 * @public
 */
export const ClassifierRowSchema = z
	.strictObject({
		repo: z.string().trim().min(1),
		categories: z.array(z.string().trim().min(1)),
		tags: z.array(z.string().trim().min(1)),
		framework: z.string().trim().min(1).nullable(),
	})
	.register(GhStarsSchemaRegistry, {
		id: "contract.github-stars.classifier.row.v1",
		title: "github-stars Classifier Row",
		description:
			"One repository classification candidate as emitted by the AI inference step. Treated as untrusted input — the validation pipeline filters categories/framework against the canonical taxonomy and discards unsupported claims before mutation.",
		owner: "src/classifier/classification-schema.ts",
		version: "1.0.0",
		stability: "p1",
	});

/**
 * Inferred TS type for one classifier row.
 *
 * @public
 */
export type ClassifierRow = z.infer<typeof ClassifierRowSchema>;

/**
 * Full classifier response: an array of rows. The model's system
 * prompt requires "Output ONLY a JSON array" — this schema enforces
 * that contract at parse time.
 *
 * @public
 */
export const ClassifierResponseSchema = z
	.array(ClassifierRowSchema)
	.register(GhStarsSchemaRegistry, {
		id: "contract.github-stars.classifier.response.v1",
		title: "github-stars Classifier Response",
		description:
			"Aggregate classifier response. Strict-array form per the system prompt's `Output ONLY a JSON array` contract. Mismatched repo names, missing rows, and extra rows are flagged downstream.",
		owner: "src/classifier/classification-schema.ts",
		version: "1.0.0",
		stability: "p1",
	});

/**
 * Inferred TS type for the classifier response array.
 *
 * @public
 */
export type ClassifierResponse = z.infer<typeof ClassifierResponseSchema>;
