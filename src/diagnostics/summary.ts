// $GITHUB_STEP_SUMMARY writer.
// Workflow steps call appendSummary(...) to add evidence-labeled lines.
//
// Closes CodeQL js/file-system-race for src/diagnostics/summary.ts:11
// structurally: instead of the prior existsSync precheck + appendFileSync
// (which had a TOCTOU window), this routes through host-io's
// appendFileTextSync. The wrapper is the boundary; the open() inside it
// is authoritative.

import { GhStarsEnv } from "../contracts/env.js";
import { appendFileTextSync, getEnv } from "../host-io/index.js";

/**
 * Append a markdown line to GITHUB_STEP_SUMMARY (no-op when unset).
 *
 * @public
 */
export function appendSummary(markdown: string): void {
	const target = getEnv(GhStarsEnv.githubStepSummary);
	if (!target) return;
	appendFileTextSync(target, `${markdown}\n`);
}

/**
 * Render an `<h{level}>` heading line.
 *
 * @public
 */
export function summaryHeading(level: number, text: string): string {
	const hashes = "#".repeat(Math.min(Math.max(level, 1), 6));
	return `${hashes} ${text}`;
}

/**
 * Render a markdown table from the supplied row matrix (header + body).
 *
 * @public
 */
export function summaryTable(
	rows: ReadonlyArray<ReadonlyArray<string>>,
): string {
	if (rows.length === 0) return "";
	const [header, ...body] = rows;
	if (!header) return "";
	const sep = header.map(() => "---");
	const fmt = (r: ReadonlyArray<string>) => `| ${r.join(" | ")} |`;
	return [fmt(header), fmt(sep), ...body.map(fmt)].join("\n");
}
