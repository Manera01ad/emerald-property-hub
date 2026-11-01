/**
 * How much weight a figure carries. Every number the site shows must carry one of these,
 * and anything without enough evidence is UNKNOWN rather than a guess.
 *
 * The set is ordered from strongest to weakest. The order matters: when two labels
 * could apply, the weaker one is used, and `evidenceRank` exists so callers can
 * compare them without hard-coding the list.
 *
 * `COMMUNITY_REPORTED` and `OFFICIAL_SOURCE` are distinct on purpose. A figure a
 * resident reported and a figure read off a government publication are not the
 * same kind of claim, and flattening them would let the weaker one inherit the
 * stronger one's credibility.
 */
export const EVIDENCE_LABELS = {
  VERIFIED: "Verified",
  OFFICIAL_SOURCE: "Official source",
  COMMUNITY_REPORTED: "Community reported",
  ESTIMATE: "Estimate",
  CLAIM: "Claim",
  UNKNOWN: "Unknown",
} as const;

export type Evidence = keyof typeof EVIDENCE_LABELS;

/** Strongest first. Used to pick the weaker of two labels, never the stronger. */
export const EVIDENCE_ORDER: Evidence[] = [
  "VERIFIED",
  "OFFICIAL_SOURCE",
  "COMMUNITY_REPORTED",
  "ESTIMATE",
  "CLAIM",
  "UNKNOWN",
];

/** 0 is the strongest. A missing label is treated as the weakest. */
export function evidenceRank(evidence: Evidence | null | undefined): number {
  if (!evidence) return EVIDENCE_ORDER.length;
  const index = EVIDENCE_ORDER.indexOf(evidence);
  return index === -1 ? EVIDENCE_ORDER.length : index;
}

/**
 * The weaker of two labels. This is the rule that stops a community report being
 * presented as something stronger: combining always descends, never ascends.
 */
export function weakerEvidence(a: Evidence, b: Evidence): Evidence {
  return evidenceRank(a) >= evidenceRank(b) ? a : b;
}

export const EVIDENCE_HELP: Record<Evidence, string> = {
  VERIFIED: "Checked against a named source we hold.",
  OFFICIAL_SOURCE: "Taken from an official publication. The source is named beside it.",
  COMMUNITY_REPORTED: "Reported by a resident. Not independently checked.",
  ESTIMATE: "Calculated from the evidence listed beside it. Not a market valuation.",
  CLAIM: "Stated by the owner or developer. Not independently checked.",
  UNKNOWN: "Not enough evidence to show a figure.",
};
