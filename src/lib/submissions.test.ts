import { describe, expect, it } from "vitest";
import {
  canOpenAnother, canSubmitToday, DECLARATION_TEXT, DECLARATION_VERSION,
  nextStatuses, validateSubmission, type SubmitInput,
} from "./submissions";

const base: SubmitInput = {
  submitterKind: "owner", name: "Lakshmi", phone: "+91 98765 43210", email: "lakshmi@example.com",
  reraNumber: "", localitySlug: "tambaram", propertyType: "villa", transactionType: "buy", bedrooms: "3",
  builtArea: "1800", landArea: "2400", askingPrice: "9500000",
  deposit: "", maintenanceMonthly: "", furnishing: "", availableFrom: "",
  leaseMonths: "", escalationPct: "", permittedUse: "", renewalTerms: "",
  description: "Corner plot.", declared: true, honeypot: "",
};

/** A complete rental submission: a monthly figure and the terms a tenant needs. */
const rental: SubmitInput = {
  ...base, transactionType: "rent", askingPrice: "25000",
  deposit: "250000", maintenanceMonthly: "2000", furnishing: "semi_furnished", availableFrom: "2026-05-01",
};

/** A complete lease submission, which additionally needs a term and an escalation clause. */
const lease: SubmitInput = {
  ...base, transactionType: "lease", askingPrice: "40000", propertyType: "apartment",
  deposit: "400000", maintenanceMonthly: "3000", furnishing: "unfurnished", availableFrom: "2026-06-01",
  leaseMonths: "36", escalationPct: "5", permittedUse: "office", renewalTerms: "renewable",
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

describe("rental and lease submissions", () => {
  it("accepts a complete rental and a complete lease", () => {
    expect(validateSubmission(rental)).toEqual({ ok: true });
    expect(validateSubmission(lease)).toEqual({ ok: true });
  });

  it("rejects a transaction type outside buy, rent and lease", () => {
    const r = validateSubmission({ ...base, transactionType: "sublet" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors["transactionType"]).toBeDefined();
  });

  it("refuses to rent or lease a plot", () => {
    const r = validateSubmission({ ...base, transactionType: "rent", propertyType: "plot", askingPrice: "20000" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors["transactionType"]).toContain("only be listed for sale");
    expect(validateSubmission({ ...base, propertyType: "plot" })).toEqual({ ok: true });
  });

  it("requires a monthly figure for rent and lease", () => {
    const rent = validateSubmission({ ...rental, askingPrice: "" });
    expect(rent.ok).toBe(false);
    if (!rent.ok) expect(rent.errors["askingPrice"]).toContain("monthly rent");
    const leaseNoRent = validateSubmission({ ...lease, askingPrice: "" });
    expect(leaseNoRent.ok).toBe(false);
  });

  it("requires a lease duration but not a rental one", () => {
    const r = validateSubmission({ ...lease, leaseMonths: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors["leaseMonths"]).toContain("whole months");
    expect(validateSubmission({ ...rental, leaseMonths: "" })).toEqual({ ok: true });
  });

  it("treats a zero deposit and zero escalation as valid, but a negative one as invalid", () => {
    expect(validateSubmission({ ...lease, deposit: "0", escalationPct: "0" })).toEqual({ ok: true });
    const r = validateSubmission({ ...lease, deposit: "-1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors["deposit"]).toBeDefined();
  });

  it("rejects a furnishing or permitted use outside the controlled lists", () => {
    const f = validateSubmission({ ...rental, furnishing: "partly" });
    expect(f.ok).toBe(false);
    if (!f.ok) expect(f.errors["furnishing"]).toBeDefined();
    const u = validateSubmission({ ...lease, permittedUse: "car_park" });
    expect(u.ok).toBe(false);
    if (!u.ok) expect(u.errors["permittedUse"]).toBeDefined();
  });

  it("allows a rental with no deposit stated, which is read as UNKNOWN rather than zero", () => {
    expect(validateSubmission({ ...rental, deposit: "" })).toEqual({ ok: true });
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
