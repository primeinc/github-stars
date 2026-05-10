// Evidence labels per issue #69 doctrine. The labels are not decorative —
// callers in workflow summaries and PR comments must use them when
// claiming a fact about a run.

export const EVIDENCE_LABELS = [
	"direct",
	"weak_inference",
	"unsupported",
	"blocked",
	"contradicted",
	"na",
] as const;

export type EvidenceLabel = (typeof EVIDENCE_LABELS)[number];

export const EVIDENCE_PREFIX: Record<EvidenceLabel, string> = {
	direct: "Direct evidence:",
	weak_inference: "Weak inference:",
	unsupported: "Unsupported:",
	blocked: "Blocked:",
	contradicted: "Contradicted:",
	na: "N/A candidate:",
};

export function labeled(label: EvidenceLabel, body: string): string {
	return `${EVIDENCE_PREFIX[label]} ${body}`;
}
