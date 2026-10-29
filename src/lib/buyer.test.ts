import { describe, expect, it } from "vitest";
import { buyAnalysis, emi, matchProperty, rentAnalysis, rentVsBuy, type Preferences } from "./buyer";
import type { CostRules } from "./deal";

const rules: CostRules = { stampDutyPct: 7, registrationPct: 2, legalFee: 0 };

/** A listing row as the transaction columns arrive from the database. */
function listing(over: Record<string, unknown> = {}) {
  return {
    id: "p1", property_type: "apartment", location: "Tambaram", asking_price: 6000000,
    bedrooms: 2, built_area_sqft: 1000, land_area_sqft: null, verification_status: "unverified",
    ...over,
  } as never;
}

const prefs = (over: Partial<Preferences> = {}): Preferences => ({
  intent: "buy", property_types: [], budget: null, preferred_locations: [],
  bedrooms: null, min_area_sqft: null, ...over,
});

describe("transaction-aware matching", () => {
  it("adds purchase costs to the budget check for a sale", () => {
    const m = matchProperty(listing(), prefs({ budget: 6000000 }), rules);
    // 60 L plus 7% duty and 2% registration is about 65.4 L, above a 60 L budget.
    expect(m.estimatedTotal).toBeCloseTo(6540000, 0);
    expect(m.concerns.join(" ")).toMatch(/exceeds your budget/i);
  });

  it("compares the monthly figure directly for a rental, without purchase costs", () => {
    const m = matchProperty(listing({ transaction_type: "rent", asking_price: 25000 }), prefs({ budget: 30000 }), rules);
    expect(m.estimatedTotal).toBe(25000);
    expect(m.concerns.join(" ")).not.toMatch(/exceeds your budget/i);
    expect(m.parts[0]?.label).toBe("Monthly rent fit");
  });

  it("flags a rental above the monthly budget", () => {
    const m = matchProperty(listing({ transaction_type: "rent", asking_price: 45000 }), prefs({ budget: 30000 }), rules);
    expect(m.concerns.join(" ")).toMatch(/monthly figure is above your budget/i);
  });

  it("lists missing rental terms so the comparison is not read as complete", () => {
    const m = matchProperty(listing({ transaction_type: "rent", asking_price: 25000 }), prefs(), rules);
    expect(m.missing).toContain("Monthly maintenance");
    expect(m.missing).toContain("Deposit");
  });

  it("lists the lease terms a lessee needs before signing", () => {
    const m = matchProperty(listing({ transaction_type: "lease", asking_price: 40000 }), prefs(), rules);
    expect(m.missing).toContain("Lease duration");
    expect(m.missing).toContain("Escalation clause");
    expect(m.missing).toContain("Deposit");
  });

  it("does not ask for a price per sq ft on a rental", () => {
    const m = matchProperty(listing({ transaction_type: "rent", asking_price: 25000, built_area_sqft: null }), prefs(), rules);
    expect(m.missing.join(" ")).not.toMatch(/price per sq ft/i);
  });

  it("still asks for a price per sq ft on a sale", () => {
    const m = matchProperty(listing({ built_area_sqft: null }), prefs(), rules);
    expect(m.missing.join(" ")).toMatch(/price per sq ft/i);
  });

  it("treats a row with no transaction type as a sale", () => {
    const m = matchProperty(listing(), prefs({ budget: 100000 }), rules);
    expect(m.parts[0]?.label).toBe("Budget fit");
  });
});

describe("buyer analytics", () => {
  const analyticsRules = { stampDutyPct: 7, registrationPct: 2, legalFee: 15000 };

  it("EMI for ₹40 L at 9% over 20 years is about ₹35,989", () => {
    expect(Math.round(emi(4_000_000, 9, 20))).toBe(35989);
  });
  it("EMI at 0% splits evenly", () => {
    expect(emi(1_200_000, 0, 10)).toBe(10000);
  });
  it("buy total adds 7% stamp duty, 2% registration, legal fee and other costs", () => {
    const r = buyAnalysis({ price: 5_000_000, otherCosts: 10000, downPayment: 1_000_000, ratePct: 9, years: 20, budget: 5_500_000 }, analyticsRules);
    expect(r.total).toBe(5_000_000 + 350_000 + 100_000 + 15000 + 10000);
    expect(r.loan).toBe(4_000_000);
    expect(r.budgetDiff).toBe(5_500_000 - r.total);
  });
  it("rent first-year outflow excludes the refundable deposit", () => {
    const r = rentAnalysis({ rent: 20000, deposit: 200000, brokerage: 20000, maintenance: 2000, moving: 10000, renewalIncreasePct: 5 });
    expect(r.firstYearOutflow).toBe(20000 * 12 + 2000 * 12 + 20000 + 10000);
    expect(r.secondYearMonthlyRent).toBe(21000);
  });
  it("rent vs buy applies renewal increases each year", () => {
    const b = buyAnalysis({ price: 1_000_000, otherCosts: 0, downPayment: 1_000_000, ratePct: 0, years: 1 }, { stampDutyPct: 0, registrationPct: 0, legalFee: 0 });
    const c = rentVsBuy(b, { rent: 10000, deposit: 0, brokerage: 0, maintenance: 0, moving: 0, renewalIncreasePct: 10 }, 2);
    expect(Math.round(c.rentPaid)).toBe(120000 + 132000);
    expect(c.buyPaid).toBe(1_000_000);
  });
});
