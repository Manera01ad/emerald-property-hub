/**
 * Document and approval screen for one listing: for each of the five key
 * documents, says whether it is verified, only recorded, expired or missing.
 *
 * Pure functions only. Nothing here certifies title or approvals — it reports
 * what PropWise recorded and how strong that record is, so a buyer knows what
 * to ask for before paying any advance.
 */

import { DOCS } from "./constants";
import { isVerificationCurrent, type ListingFacts } from "./verification";
import type { Evidence } from "./evidence";

export type DocStatus = "verified" | "recorded" | "expired" | "missing" | "not_applicable";

export const DOC_STATUS_LABELS: Record<DocStatus, string> = {
  verified: "Verified",
  recorded: "Recorded, not verified",
  expired: "Verification expired",
  missing: "Missing",
  not_applicable: "Not applicable",
};

export type DocCheck = {
  key: string;
  label: string;
  status: DocStatus;
  /** Evidence label for the record; null when the document does not apply. */
  evidence: Evidence | null;
  note: string;
};

export type DocumentScreen = {
  checks: DocCheck[];
  counts: Record<DocStatus, number>;
  headline: string;
  /** True when any applicable document is missing or its verification has expired. */
  needsAttention: boolean;
};

type DocKey = "doc_title_deed" | "doc_encumbrance" | "doc_patta" | "doc_approved_plan" | "doc_building_permit";

const today = () => new Date().toISOString().slice(0, 10);

function hasExpired(p: ListingFacts, on: string): boolean {
  const checked = p.verification_status === "verified" || p.verification_status === "partially_verified";
  return checked && !!p.verification_evidence && !!p.verification_expiry && p.verification_expiry < on;
}

/** The status of one document on one listing. */
export function checkDocument(p: ListingFacts, key: DocKey, label: string, on: string = today()): DocCheck {
  // A bare plot has no building on it, so a building permit or completion certificate cannot exist yet.
  if (key === "doc_building_permit" && p.property_type === "plot") {
    return { key, label, status: "not_applicable", evidence: null, note: "A plot has no building, so there is no building permit or completion certificate to check." };
  }
  if (p[key] !== true) {
    return { key, label, status: "missing", evidence: "UNKNOWN", note: "Not recorded by PropWise. Ask the seller for a copy before paying any advance." };
  }
  if (hasExpired(p, on)) {
    return { key, label, status: "expired", evidence: "UNKNOWN", note: `The verification expired on ${p.verification_expiry}. Ask for fresh copies and have them re-checked.` };
  }
  if (p.verification_status === "verified" && isVerificationCurrent(p, on)) {
    const date = p.verification_date ? ` on ${p.verification_date}` : "";
    return { key, label, status: "verified", evidence: "VERIFIED", note: `Seen and verified${date}, with evidence on record.` };
  }
  const why = p.verification_status === "partially_verified"
    ? "The listing is only partially verified, and this document was not confirmed on its own."
    : "A copy was recorded, but it has not been independently verified.";
  return { key, label, status: "recorded", evidence: "CLAIM", note: why };
}

/** Screens all five key documents and summarises what a buyer should do next. */
export function screenDocuments(p: ListingFacts, on: string = today()): DocumentScreen {
  const checks = DOCS.map((d) => checkDocument(p, d.key as DocKey, d.label, on));
  const counts = checks.reduce(
    (acc, c) => ({ ...acc, [c.status]: acc[c.status] + 1 }),
    { verified: 0, recorded: 0, expired: 0, missing: 0, not_applicable: 0 } as Record<DocStatus, number>,
  );
  const applicable = checks.length - counts.not_applicable;
  const needsAttention = counts.missing > 0 || counts.expired > 0;

  let headline: string;
  if (counts.missing > 0) {
    headline = `${counts.missing} of ${applicable} key documents are not recorded. Ask for them before paying any advance.`;
  } else if (counts.expired > 0) {
    headline = "All key documents were recorded, but the verification has expired. Ask for fresh copies, especially a current encumbrance certificate.";
  } else if (counts.recorded > 0) {
    headline = `All ${applicable} key documents are recorded, but ${counts.recorded} are not independently verified. Have a lawyer review the originals.`;
  } else {
    headline = `All ${applicable} key documents are recorded and verified. Still have a lawyer review the originals before you commit.`;
  }
  return { checks, counts, headline, needsAttention };
}
