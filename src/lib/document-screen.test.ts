import { describe, expect, it } from "vitest";
import { checkDocument, screenDocuments } from "./document-screen";
import type { ListingFacts } from "./verification";

const TODAY = "2026-11-02";
const allDocs = { doc_title_deed: true, doc_encumbrance: true, doc_patta: true, doc_approved_plan: true, doc_building_permit: true };
const verified: ListingFacts = {
  property_type: "villa",
  ...allDocs,
  verification_status: "verified",
  verification_evidence: "Copies reviewed by PropWise",
  verification_date: "2026-09-01",
  verification_expiry: "2027-03-01",
};

describe("document screen", () => {
  it("marks every document missing when nothing is recorded", () => {
    const s = screenDocuments({ property_type: "apartment", verification_status: "unverified" }, TODAY);
    expect(s.counts.missing).toBe(5);
    expect(s.needsAttention).toBe(true);
    expect(s.headline).toMatch(/5 of 5 key documents are not recorded/);
    expect(s.checks.every((c) => c.evidence === "UNKNOWN")).toBe(true);
  });

  it("verifies documents only with a current, evidenced verification", () => {
    const s = screenDocuments(verified, TODAY);
    expect(s.counts.verified).toBe(5);
    expect(s.needsAttention).toBe(false);
    expect(s.headline).toMatch(/recorded and verified/);
    expect(s.checks[0]?.note).toContain("2026-09-01");
  });

  it("treats verified-without-evidence as recorded, never verified", () => {
    const s = screenDocuments({ ...verified, verification_evidence: null }, TODAY);
    expect(s.counts.verified).toBe(0);
    expect(s.counts.recorded).toBe(5);
    expect(s.checks[0]?.evidence).toBe("CLAIM");
  });

  it("flags an expired verification", () => {
    const s = screenDocuments({ ...verified, verification_expiry: "2026-10-01" }, TODAY);
    expect(s.counts.expired).toBe(5);
    expect(s.needsAttention).toBe(true);
    expect(s.headline).toMatch(/expired/);
    expect(s.checks[1]?.note).toContain("2026-10-01");
  });

  it("does not let partial verification confirm any single document", () => {
    const c = checkDocument({ ...verified, verification_status: "partially_verified" }, "doc_patta", "Patta", TODAY);
    expect(c.status).toBe("recorded");
    expect(c.note).toMatch(/partially verified/);
  });

  it("does not ask for a building permit on a bare plot", () => {
    const s = screenDocuments({ ...verified, property_type: "plot", doc_building_permit: false }, TODAY);
    const permit = s.checks.find((c) => c.key === "doc_building_permit");
    expect(permit?.status).toBe("not_applicable");
    expect(permit?.evidence).toBeNull();
    expect(s.counts.verified).toBe(4);
    expect(s.headline).toMatch(/All 4 key documents/);
  });

  it("mixes statuses: a missing EC outranks everything else in the headline", () => {
    const s = screenDocuments({ ...verified, doc_encumbrance: false }, TODAY);
    expect(s.checks.find((c) => c.key === "doc_encumbrance")?.status).toBe("missing");
    expect(s.headline).toMatch(/1 of 5 key documents are not recorded/);
  });
});
