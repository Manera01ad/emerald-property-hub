import { describe, expect, it } from "vitest";
import { buildBrief, type BriefProperty } from "./brief";

const rules = { stampDutyPct: 7, registrationPct: 2, legalFee: 20000 };
const base: BriefProperty = {
  property_type: "plot", asking_price: 5_000_000, guideline_value: 4_000_000, survey_number: "12/3", approvals: ["DTCP"], rera_number: null,
  verification_status: "verified", doc_patta: true, doc_title_deed: true, doc_encumbrance: true, doc_approved_plan: true, doc_building_permit: false,
};

describe("buildBrief", () => {
  it("counts documents seen and has no red flags for a clean plot", () => {
    const b = buildBrief(base, rules);
    expect(b.readiness).toEqual({ seen: 5, total: 5 });
    expect(b.redFlags).toHaveLength(0);
    expect(b.steps.find((s) => s.id === "permit")).toBeUndefined();
    expect(b.steps.find((s) => s.id === "rera")).toBeUndefined();
  });
  it("adds permit and RERA steps for an apartment and marks missing ones as needed", () => {
    const b = buildBrief({ ...base, property_type: "apartment", doc_building_permit: false }, rules);
    expect(b.steps.find((s) => s.id === "permit")!.status).toBe("needed");
    expect(b.steps.find((s) => s.id === "rera")!.status).toBe("needed");
  });
  it("flags a price far below guideline and unverified listings", () => {
    const b = buildBrief({ ...base, asking_price: 2_000_000, verification_status: "pending" }, rules);
    expect(b.redFlags).toHaveLength(2);
  });
  it("flags RERA claimed without a number", () => {
    const b = buildBrief({ ...base, approvals: ["RERA"] }, rules);
    expect(b.redFlags.some((f) => f.includes("RERA"))).toBe(true);
  });
  it("duties use the higher of price and guideline value", () => {
    const b = buildBrief({ ...base, asking_price: 3_000_000 }, rules);
    expect(b.cost.base).toBe(4_000_000);
  });
  it("asks for the survey number only when missing", () => {
    expect(buildBrief(base, rules).questions.some((q) => q.includes("survey"))).toBe(false);
    expect(buildBrief({ ...base, survey_number: null }, rules).questions[0]).toContain("survey");
  });
});
