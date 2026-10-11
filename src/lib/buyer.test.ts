import { describe, expect, it } from "vitest";
import { buyAnalysis, emi, rentAnalysis, rentVsBuy } from "./buyer";

const rules = { stampDutyPct: 7, registrationPct: 2, legalFee: 15000 };

describe("buyer analytics", () => {
  it("EMI for ₹40 L at 9% over 20 years is about ₹35,989", () => {
    expect(Math.round(emi(4_000_000, 9, 20))).toBe(35989);
  });
  it("EMI at 0% splits evenly", () => {
    expect(emi(1_200_000, 0, 10)).toBe(10000);
  });
  it("buy total adds 7% stamp duty, 2% registration, legal fee and other costs", () => {
    const r = buyAnalysis({ price: 5_000_000, otherCosts: 10000, downPayment: 1_000_000, ratePct: 9, years: 20, budget: 5_500_000 }, rules);
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
