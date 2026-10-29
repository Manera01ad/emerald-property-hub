import { describe, expect, it } from "vitest";
import { disclosureFor, disclosureSummary, discloseFacts, isVerificationCurrent, type ListingFacts } from "./verification";

const TODAY = "2026-10-29";

const base: ListingFacts = {
  property_type: "villa",
  asking_price: 8500000,
  built_area_sqft: 1650,
  land_area_sqft: 1200,
  approvals: ["DTCP"],
  rera_number: "TN/01/BUILDING/0001/2026",
  survey_number: "12/3A",
  source: "Developer brochure",
  verification_status: "verified",
  verification_evidence: "Title deed and DTCP approval inspected on site",
  verification_date: "2026-10-01",
  verification_expiry: "2027-10-01",
  doc_title_deed: true,
  doc_encumbrance: true,
  doc_patta: true,
  doc_approved_plan: true,
  doc_building_permit: true,
};

describe("isVerificationCurrent", () => {
  it("accepts a verified listing with evidence and an in-date expiry", () => {
    expect(isVerificationCurrent(base, TODAY)).toBe(true);
  });

  it("treats an expired verification as not current", () => {
    expect(isVerificationCurrent({ ...base, verification_expiry: "2026-01-01" }, TODAY)).toBe(false);
  });

  it("requires evidence, not just a status", () => {
    expect(isVerificationCurrent({ ...base, verification_evidence: null }, TODAY)).toBe(false);
    expect(isVerificationCurrent({ ...base, verification_evidence: "" }, TODAY)).toBe(false);
  });

  it("requires an in-date verification record", () => {
    expect(isVerificationCurrent({ ...base, verification_status: "unverified" }, TODAY)).toBe(false);
    expect(isVerificationCurrent({ ...base, verification_status: null }, TODAY)).toBe(false);
  });

  it("accepts a partially verified record that is in date and evidenced, but that is not full verification", () => {
    const partial = { ...base, verification_status: "partially_verified" };
    expect(isVerificationCurrent(partial, TODAY)).toBe(true);
    expect(disclosureFor(partial, TODAY).status).toBe("estimate");
  });

  it("treats a verification with no expiry date as current when evidence exists", () => {
    expect(isVerificationCurrent({ ...base, verification_expiry: null }, TODAY)).toBe(true);
  });
});

describe("disclosureFor", () => {
  it("reports verified when the record is current", () => {
    expect(disclosureFor(base, TODAY).status).toBe("verified");
  });

  it("downgrades an expired verification to missing, so it is never shown as verified", () => {
    const d = disclosureFor({ ...base, verification_expiry: "2026-01-01" }, TODAY);
    expect(d.status).toBe("missing");
    expect(d.note).toMatch(/expired/i);
  });

  it("reports estimate for owner-supplied data with no verification", () => {
    expect(disclosureFor({ ...base, verification_status: "unverified" }, TODAY).status).toBe("estimate");
    expect(disclosureFor({ ...base, verification_status: null }, TODAY).status).toBe("estimate");
  });

  it("reports estimate for a partially verified listing", () => {
    expect(disclosureFor({ ...base, verification_status: "partially_verified" }, TODAY).status).toBe("estimate");
  });

  it("never reports verified without evidence", () => {
    expect(disclosureFor({ ...base, verification_evidence: null }, TODAY).status).not.toBe("verified");
  });
});

describe("discloseFacts", () => {
  it("marks every missing field as missing and every recorded field with the listing status", () => {
    const facts = discloseFacts(base, TODAY);
    expect(facts.every((f) => f.disclosure === "verified")).toBe(true);
  });

  it("lists missing documents as missing, not as verified", () => {
    const facts = discloseFacts({ ...base, doc_patta: false, doc_building_permit: false }, TODAY);
    const patta = facts.find((f) => f.key === "patta");
    expect(patta?.disclosure).toBe("missing");
    expect(patta?.note).toMatch(/not recorded/i);
  });

  it("never labels an owner-supplied listing as verified", () => {
    const facts = discloseFacts({ ...base, verification_status: "unverified" }, TODAY);
    expect(facts.some((f) => f.disclosure === "verified")).toBe(false);
    expect(facts.some((f) => f.disclosure === "estimate")).toBe(true);
  });

  it("uses the plot area for plots and the built-up area otherwise", () => {
    const plot = discloseFacts({ ...base, property_type: "plot", built_area_sqft: null, land_area_sqft: 1200 }, TODAY);
    expect(plot.find((f) => f.key === "area")?.disclosure).toBe("verified");
    const house = discloseFacts({ ...base, built_area_sqft: null }, TODAY);
    expect(house.find((f) => f.key === "area")?.disclosure).toBe("missing");
  });

  it("summarises the counts", () => {
    const facts = discloseFacts({ ...base, verification_status: "unverified", doc_patta: false }, TODAY);
    const summary = disclosureSummary(facts);
    expect(summary.verified).toBe(0);
    expect(summary.missing).toBe(1);
    expect(summary.estimate + summary.missing).toBe(facts.length);
  });
});
