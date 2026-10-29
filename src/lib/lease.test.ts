import { describe, expect, it } from "vitest";

import {
  compareLease,
  leaseTotal,
  permittedUseLabel,
  renewalLabel,
  type LeaseTerms,
} from "./lease";

const base: LeaseTerms = {
  monthly_rent: 40000,
  deposit: 400000,
  maintenance_monthly: 3000,
  furnishing: "unfurnished",
  available_from: "2026-06-01",
  lease_months: 36,
  escalation_pct: 5,
  permitted_use: "office",
  renewal_terms: "renewable",
};

describe("lease comparison", () => {
  it("labels permitted use and renewal only for known values", () => {
    expect(permittedUseLabel("office")).toBe("Office");
    expect(permittedUseLabel("car_park")).toBe("Unknown");
    expect(renewalLabel("renewable")).toBe("Renewable");
    expect(renewalLabel("maybe")).toBe("Unknown");
  });

  it("applies the stated escalation across the term", () => {
    const t = leaseTotal(base);
    // Year 1 480,000; year 2 504,000; year 3 529,200.
    expect(t.total).toBeCloseTo(1513200, 0);
    expect(t.firstYearRent).toBe(480000);
    expect(t.finalYearMonthlyRent).toBeCloseTo(44100, 0);
    expect(t.evidence).toBe("ESTIMATE");
  });

  it("handles a term that is not a whole number of years", () => {
    const t = leaseTotal({ ...base, lease_months: 18, escalation_pct: 10 });
    // 12 months at 40,000 plus 6 months at 44,000.
    expect(t.total).toBeCloseTo(480000 + 264000, 0);
  });

  it("refuses a total when the escalation clause is unknown", () => {
    const t = leaseTotal({ ...base, escalation_pct: null });
    expect(t.total).toBeNull();
    expect(t.evidence).toBe("UNKNOWN");
    expect(t.note).toMatch(/escalation clause is not stated/i);
  });

  it("refuses a total when the duration is unknown", () => {
    const t = leaseTotal({ ...base, lease_months: null });
    expect(t.total).toBeNull();
    expect(t.evidence).toBe("UNKNOWN");
  });

  it("treats a zero escalation as stated and totals without increase", () => {
    const t = leaseTotal({ ...base, escalation_pct: 0 });
    expect(t.total).toBe(480000 * 3);
    expect(t.evidence).toBe("ESTIMATE");
  });

  it("marks a fully stated lease as CLAIM with no gaps", () => {
    const c = compareLease(base);
    expect(c.known).toBe(5);
    expect(c.evidence).toBe("CLAIM");
    expect(c.gaps).toEqual([]);
  });

  it("marks a partly stated lease as UNKNOWN and lists the gaps", () => {
    const c = compareLease({
      ...base,
      lease_months: null,
      escalation_pct: null,
      renewal_terms: null,
    });
    expect(c.evidence).toBe("UNKNOWN");
    expect(c.gaps).toContain("Lease duration");
    expect(c.gaps).toContain("Escalation clause");
    expect(c.gaps).toContain("Renewal terms");
  });

  it("raises a caution for every term a lessee could be surprised by", () => {
    const c = compareLease({
      ...base,
      escalation_pct: null,
      renewal_terms: null,
      deposit: null,
      permitted_use: "industrial",
    });
    expect(c.cautions.length).toBe(4);
    expect(c.cautions.join(" ")).toMatch(/escalation clause/i);
    expect(c.cautions.join(" ")).toMatch(/renewal right/i);
    expect(c.cautions.join(" ")).toMatch(/deposit is not stated/i);
    expect(c.cautions.join(" ")).toMatch(/Industrial/);
  });

  it("does not caution about permitted use when it is residential", () => {
    const c = compareLease({ ...base, permitted_use: "residential" });
    expect(c.cautions.join(" ")).not.toMatch(/permitted use is recorded/i);
  });

  it("never states a total that assumes no escalation", () => {
    const c = compareLease({ ...base, escalation_pct: null });
    expect(c.total.total).toBeNull();
  });
});
