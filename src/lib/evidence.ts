/**
 * How much weight a figure carries. Every number the site shows must carry one of these,
 * and anything without enough evidence is UNKNOWN rather than a guess.
 */
export const EVIDENCE_LABELS = {
  VERIFIED: "Verified",
  ESTIMATE: "Estimate",
  CLAIM: "Claim",
  UNKNOWN: "Unknown",
} as const;

export type Evidence = keyof typeof EVIDENCE_LABELS;

export const EVIDENCE_HELP: Record<Evidence, string> = {
  VERIFIED: "Checked against a named source we hold.",
  ESTIMATE: "Calculated from the evidence listed beside it. Not a market valuation.",
  CLAIM: "Stated by the owner or developer. Not independently checked.",
  UNKNOWN: "Not enough evidence to show a figure.",
};
