import { describe, expect, it } from "vitest";
import {
  canOpenAnother, canSubmitToday, DECLARATION_TEXT, DECLARATION_VERSION,
  nextStatuses, validateSubmission, type SubmitInput,
} from "./submissions";

const base: SubmitInput = {
  submitterKind: "owner", name: "Lakshmi", phone: "+91 98765 43210", email: "lakshmi@example.com",
  reraNumber: "", localitySlug: "tambaram", propertyType: "villa", bedrooms: "3",
  builtArea: "1800", landArea: "2400", askingPrice: "9500000", description: "Corner plot.",
  declared: true, honeypot: "",
};

describe("submission validation", () => {
  it("accepts a complete owner submission", () => {
    expect(validateSubmission(base)).toEqual({ ok: true });
  });

  it("requires a TNRERA number from a developer", () => {
    const r = validateSubmission({ ...base, submitterKind: "developer", reraNumber: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors["reraNumber"]).toContain("TNRERA");
    expect(validateSubmission({ ...base, submitterKind: "developer", reraNumber: "TN/01/BUILDING/0001/2026" })).toEqual({ ok: true });
  });

  it("requires the declaration", () => {
    const r = validateSubmission({ ...base, declared: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors["declared"]).toBeDefined();
  });

  it("rejects a filled honeypot", () => {
    const r = validateSubmission({ ...base, honeypot: "Acme Ltd" });
    expect(r.ok).toBe(false);
  });

  it("rejects a locality outside the controlled list and bad numbers", () => {
    const r = validateSubmission({ ...base, localitySlug: "", askingPrice: "-5", builtArea: "abc" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors["localitySlug"]).toBeDefined();
      expect(r.errors["askingPrice"]).toBeDefined();
      expect(r.errors["builtArea"]).toBeDefined();
    }
  });

  it("allows an owner to leave price and area blank", () => {
    expect(validateSubmission({ ...base, askingPrice: "", builtArea: "", landArea: "", bedrooms: "" })).toEqual({ ok: true });
  });

  it("pins the declaration version so stored text can be matched later", () => {
    expect(DECLARATION_VERSION).toMatch(/^owner-declaration-/);
    expect(DECLARATION_TEXT).toContain("permission to publish");
  });
});

describe("moderation transitions", () => {
  it("mirrors the database transitions", () => {
    expect(nextStatuses("submitted")).toEqual(["in_review", "approved", "needs_changes", "rejected"]);
    expect(nextStatuses("in_review")).toEqual(["approved", "needs_changes", "rejected"]);
    expect(nextStatuses("needs_changes")).toEqual(["in_review", "rejected"]);
    expect(nextStatuses("approved")).toEqual([]);
    expect(nextStatuses("rejected")).toEqual([]);
  });
});

describe("limits", () => {
  it("allows three submissions in a day and refuses the fourth", () => {
    const now = new Date("2026-03-10T12:00:00Z");
    const three = ["2026-03-10T08:00:00Z", "2026-03-10T09:00:00Z", "2026-03-10T10:00:00Z"];
    expect(canSubmitToday(three, now)).toBe(false);
    expect(canSubmitToday(three.slice(0, 2), now)).toBe(true);
  });

  it("ignores submissions older than a day", () => {
    const now = new Date("2026-03-10T12:00:00Z");
    expect(canSubmitToday(["2026-03-08T08:00:00Z", "2026-03-09T01:00:00Z"], now)).toBe(true);
  });

  it("allows three open submissions and no more", () => {
    expect(canOpenAnother(["submitted", "in_review", "needs_changes"])).toBe(false);
    expect(canOpenAnother(["approved", "rejected", "submitted"])).toBe(true);
  });
});
