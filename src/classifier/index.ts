// Public surface of the classifier validation kernel. Per issue #71:
//
//   classifier output is CANDIDATE classification, not truth.
//   Every claim passes through this surface before it can mutate
//   repos.yml.
//
// CLI entry point: src/classifier/cli.ts (`bun run classify:apply`),
// invoked by .github/workflows/03-classify-repos.yml as the typed
// gate between "AI inference returns JSON" and "manifest mutation."

export type {
	ClassifierResponse,
	ClassifierRow,
} from "./classification-schema.js";
export {
	ClassifierResponseSchema,
	ClassifierRowSchema,
} from "./classification-schema.js";
export type {
	ClassifierValidationResult,
	RepoEvidence,
	ValidatedClassification,
} from "./validator.js";
export {
	parseAndValidate,
	validateResponse,
	validateRow,
} from "./validator.js";
