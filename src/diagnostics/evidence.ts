// Evidence labels per issue #69 doctrine. The labels are not decorative —
// callers in workflow summaries and PR comments must use them when
// claiming a fact about a run.

/**
 * Source-of-truth tuple for evidence labels. Drives both the
 * {@link EvidenceLabel} type and the {@link EVIDENCE_PREFIX} dictionary.
 *
 * @remarks
 * Per issue #69 doctrine, every fact-claim in workflow summaries and
 * PR comments must carry one of these labels. Prevents handwavy
 * claims by forcing the author to classify the evidence class.
 *
 * @public
 */
export const EVIDENCE_LABELS = [
	"direct",
	"weak_inference",
	"unsupported",
	"blocked",
	"contradicted",
	"na",
] as const;

/**
 * Literal-union over {@link EVIDENCE_LABELS}.
 *
 * @public
 */
export type EvidenceLabel = (typeof EVIDENCE_LABELS)[number];

/**
 * Map from each {@link EvidenceLabel} to the human-readable prefix
 * string {@link labeled} prepends to its body. Frozen at module load.
 *
 * @public
 */
export const EVIDENCE_PREFIX: Record<EvidenceLabel, string> = {
	direct: "Direct evidence:",
	weak_inference: "Weak inference:",
	unsupported: "Unsupported:",
	blocked: "Blocked:",
	contradicted: "Contradicted:",
	na: "N/A candidate:",
};

/**
 * Render a single evidence-labeled line for a workflow summary, PR
 * comment, or log statement. The prefix is taken from
 * {@link EVIDENCE_PREFIX} so a typo in the label fails at compile time.
 *
 * @example
 * ```ts
 * labeled("direct", "fetched 2,612 repos from /users/primeinc/starred");
 * // → "Direct evidence: fetched 2,612 repos from /users/primeinc/starred"
 * ```
 *
 * @param label - The evidence class for the claim.
 * @param body - The claim itself.
 * @returns The formatted line, ready to write to stdout / a markdown summary.
 *
 * @public
 */
export function labeled(label: EvidenceLabel, body: string): string {
	return `${EVIDENCE_PREFIX[label]} ${body}`;
}
