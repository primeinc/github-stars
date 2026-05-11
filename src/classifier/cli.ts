#!/usr/bin/env bun
/**
 * Classifier validation CLI: `bun run classify:apply <model-output> <batch-meta>`.
 *
 * Per issue #71, this is the typed gate between the model's raw JSON
 * output and any mutation of `repos.yml`. The 03-classify-repos
 * workflow's "Apply" step pipes its model response through this CLI;
 * the CLI parses, validates against the canonical taxonomy and the
 * gathered evidence, and writes a typed result file the next step
 * can consume.
 *
 * Inputs:
 *   - argv[2]: path to a JSON file containing the raw model output
 *     (the response from `actions/ai-inference@v2`).
 *   - argv[3]: path to a JSON file describing the requested batch:
 *     `{ batchRepos: string[], evidence: RepoEvidence[], taxonomy: Taxonomy }`.
 *   - argv[4]: path to write the typed `ClassifierValidationResult`.
 *
 * Exit code 0 even when rows are rejected — the workflow consumes
 * the result file and decides whether to commit (accepted only) or
 * mark needs_review. A non-zero exit means the model output couldn't
 * be parsed at all (invalid_json, schema_violation), which the
 * workflow treats as a retry signal.
 */

import { setOutput } from "../cli/dual-write.js";
import {
	exit,
	processArgv,
	readTextFileSync,
	writeStderrLine,
	writeTextFileAtomicSync,
} from "../host-io/index.js";
import { parseAndValidate } from "./index.js";

const argv = processArgv();
const modelOutputPath = argv[2];
const batchMetaPath = argv[3];
const resultPath = argv[4];

if (!modelOutputPath || !batchMetaPath || !resultPath) {
	writeStderrLine(
		"usage: bun run src/classifier/cli.ts <model-output.json> <batch-meta.json> <result.json>",
	);
	exit(2);
}

const raw = readTextFileSync(modelOutputPath);
const meta = JSON.parse(readTextFileSync(batchMetaPath));

// Strip common AI-inference markdown fences before handing to the
// validator (the validator stays pure; sanitisation lives here).
const cleaned = raw
	.trim()
	.replace(/^```json\s*/i, "")
	.replace(/^```\s*/i, "")
	.replace(/\s*```$/i, "");

const validated = parseAndValidate({
	raw: cleaned,
	batchRepos: meta.batchRepos,
	taxonomy: meta.taxonomy,
	evidence: meta.evidence ?? [],
});

if (!validated.ok) {
	writeStderrLine(`::error::Classifier output rejected: ${validated.reason}`);
	setOutput("classifier_parse_failed=true");
	setOutput(`classifier_parse_reason=${validated.reason}`);
	exit(1);
}

const r = validated.result;
writeTextFileAtomicSync(resultPath, JSON.stringify(r, null, 2));

writeStderrLine(
	`Classifier validation: batch=${r.summary.batchSize} returned=${r.summary.returnedRowCount} accepted=${r.summary.acceptedCount} needs_review=${r.summary.needsReviewCount} rejected=${r.summary.rejectedCount} missing=${r.summary.missingFromResponse.length} extra=${r.summary.extraInResponse.length}`,
);

setOutput("classifier_parse_failed=false");
setOutput(`classifier_accepted=${r.summary.acceptedCount}`);
setOutput(`classifier_needs_review=${r.summary.needsReviewCount}`);
setOutput(`classifier_rejected=${r.summary.rejectedCount}`);
setOutput(`classifier_missing=${r.summary.missingFromResponse.length}`);
setOutput(`classifier_extra=${r.summary.extraInResponse.length}`);
