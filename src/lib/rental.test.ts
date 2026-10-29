import { describe, expect, it } from "vitest";

import {
  compareRental,
  furnishingLabel,
  isFurnishingState,
  monthlyOutgoings,
  moveInCash,
  type RentalTerms,
} from "./rental";

const base: RentalTerms = {
  monthly_rent: 25000,
  deposit: 250000,
  maintenance_monthly: 2000,
  furnishing: "semi_furnished",
  available_from: "2026-05-01",
  lease_months: null,
};

describe("rental comparison", () => {
  it("labels furnishing only for known states", () => {
    expect(isFurnishingState("fully_furnished")).toBe(true);
    expect(isFurnishingState("partly")).toBe(false);
    expect(furnishingLabel("semi_furnished")).toBe("Semi-furnished");
    expect(furnishingLabel(null)).toBe("Unknown");
  });

  it("adds rent and maintenance into a monthly total", () => {
    const m = monthlyOutgoings(base);
    expect(m.total).toBe(27000);
    expect(m.evidence).toBe("CLAIM");
  });

  it("refuses a monthly total when maintenance is not stated", () => {
    const m = monthlyOutgoings({ ...base, maintenance_monthly: null });
    expect(m.total).toBeNull();
    expect(m.evidence).toBe("UNKNOWN");
    expect(m.rent).toBe(25000);
    expect(m.note).toMatch(/maintenance is not stated/i);
  });

  it("reports UNKNOWN rather than zero when there is no rent at all", () => {
    const m = monthlyOutgoings({ ...base, monthly_rent: null });
    expect(m.total).toBeNull();
    expect(m.evidence).toBe("UNKNOWN");
  });

  it("treats a zero maintenance as stated, not missing", () => {
    const m = monthlyOutgoings({ ...base, maintenance_monthly: 0 });
    expect(m.total).toBe(25000);
  });

  it("computes move-in cash as deposit plus the first month", () => {
    const c = moveInCash(base);
    expect(c.deposit).toBe(250000);
    expect(c.firstMonth).toBe(27000);
    expect(c.total).toBe(277000);
  });

  it("refuses move-in cash when the deposit is unknown", () => {
    const c = moveInCash({ ...base, deposit: null });
    expect(c.total).toBeNull();
    expect(c.firstMonth).toBe(27000);
    expect(c.note).toMatch(/deposit is not stated/i);
  });

  it("marks a fully stated rental as CLAIM with no gaps", () => {
    const r = compareRental(base);
    expect(r.known).toBe(5);
    expect(r.evidence).toBe("CLAIM");
    expect(r.gaps).toEqual([]);
  });

  it("marks a partly stated rental as UNKNOWN and lists the gaps", () => {
    const r = compareRental({
      ...base,
      maintenance_monthly: null,
      deposit: null,
      available_from: null,
    });
    expect(r.evidence).toBe("UNKNOWN");
    expect(r.gaps).toContain("Monthly maintenance");
    expect(r.gaps).toContain("Deposit");
    expect(r.gaps).toContain("Availability");
  });

  it("never reports a total that assumes a missing figure is zero", () => {
    const r = compareRental({ ...base, maintenance_monthly: null });
    expect(r.monthly.total).toBeNull();
    expect(r.moveIn.total).toBeNull();
  });
});
