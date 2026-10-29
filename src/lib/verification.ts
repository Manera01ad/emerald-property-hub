/**
 * Classifies every listing fact as verified, estimated or missing, so the UI can
 * never present an estimate as a fact or a missing value as if it were known.
 *
 * Pure functions only. Nothing here certifies title, approvals or RERA — it only
 * reports what was recorded and how strong that record is.
 */

export type Disclosure = "verified" | "estimate" | "missing";

export type ListingFacts = {
  property_type: string;
  asking_price?: number | null;
  guideline_value?: number | null;
  built_area_sqft?: number | null;
  land_area_sqft?: number | null;
  approvals?: string[] | null;
  rera_number?: string | null;
  survey_number?: string | null;
  source?: string | null;
  verification_status?: string | null;
  verification_evidence?: string | null;
  verification_date?: string | null;
  verification_expiry?: string | null;
  doc_title_deed?: boolean;
  doc_encumbrance?: boolean;
  doc_patta?: boolean;
  doc_approved_plan?: boolean;
  doc_building_permit?: boolean;
};

export type Fact = {
  key: string;
  label: string;
  disclosure: Disclosure;
  /** What is shown next to the value, in plain words. */
  note: string;
};

/**
 * A verification only counts while it is in date. An expired record is treated as
 * missing, because the underlying facts have not been re-checked.
 */
export function isVerificationCurrent(p: ListingFacts, today: string = new Date().toISOString().slice(0, 10)): boolean {
  if (p.verification_status !== "verified" && p.verification_status !== "partially_verified") return false;
  if (!p.verification_evidence) return false;
  if (p.verification_expiry && p.verification_expiry < today) return false;
  return true;
}

const has = (v: unknown): boolean => v !== null && v !== undefined && v !== "";

/**
 * The disclosure for one recorded field. `verified` requires a current
 * verification record; without it, a recorded value is owner-supplied and
 * unverified, which is still shown but never labelled as verified.
 */
export function disclosureFor(p: ListingFacts, today?: string): { status: Disclosure; note: string } {
  const current = isVerificationCurrent(p, today);
  if (p.verification_status === "verified" && !current) {
    return { status: "missing", note: "Verification has expired or has no evidence on record — treat as unverified." };
  }
  // Partial verification is checked before the verified branch: some details were
  // checked and others were not, so the listing as a whole is still an estimate.
  if (p.verification_status === "partially_verified") {
    return current
      ? { status: "estimate", note: "Partially verified: some details checked, others owner-supplied." }
      : { status: "estimate", note: "Partial verification has expired or has no evidence on record." };
  }
  if (current) return { status: "verified", note: "Recorded and verified, with evidence and a current date." };
  return { status: "estimate", note: "Owner/developer supplied. Not independently verified." };
}

/** Builds the full disclosure list for a listing, one entry per fact shown to a buyer. */
export function discloseFacts(p: ListingFacts, today?: string): Fact[] {
  const base = disclosureFor(p, today);
  const facts: Fact[] = [];
  const add = (key: string, label: string, present: boolean, note?: string) => {
    if (!present) {
      facts.push({ key, label, disclosure: "missing", note: note ?? "Not recorded." });
      return;
    }
    facts.push({ key, label, disclosure: base.status, note: note ?? base.note });
  };

  const isPlot = p.property_type === "plot";
  add("asking_price", "Asking price", p.asking_price != null);
  add("area", isPlot ? "Plot area" : "Built-up area", isPlot ? p.land_area_sqft != null : p.built_area_sqft != null);
  add("approvals", "Layout/building approvals", !!p.approvals?.length);
  add("rera", "RERA registration", has(p.rera_number), isPlot ? "Plots are not RERA-registered projects." : undefined);
  add("survey_number", "Survey number", has(p.survey_number));
  add("title_deed", "Title deed seen", p.doc_title_deed === true);
  add("encumbrance", "Encumbrance certificate seen", p.doc_encumbrance === true);
  add("patta", "Patta seen", p.doc_patta === true);
  add("approved_plan", "Approved plan seen", p.doc_approved_plan === true);
  add("building_permit", "Building permit seen", p.doc_building_permit === true);
  add("source", "Information source", has(p.source));

  return facts;
}

/** Totals for a short summary line: how many facts are verified, estimated and missing. */
export function disclosureSummary(facts: Fact[]): Record<Disclosure, number> {
  return facts.reduce(
    (acc, f) => ({ ...acc, [f.disclosure]: acc[f.disclosure] + 1 }),
    { verified: 0, estimate: 0, missing: 0 } as Record<Disclosure, number>,
  );
}

/**
 * Any figure derived from asking prices is an estimate by definition, regardless
 * of how well the listing itself is verified. Used to label computed values.
 */
export const ESTIMATE_LABEL = "Estimate — based on asking prices only, not a valuation or a legal check.";
