import { describe, expect, it } from "vitest";
import { comparablesFor, dealScore, purchaseCost } from "./deal";

const rules = { stampDutyPct: 7, registrationPct: 2, legalFee: 15000 };

describe("purchase cost", () => {
  it("charges stamp duty and registration on the asking price when it is higher", () => {
    const c = purchaseCost({ asking_price: 10000000, guideline_value: 8000000 }, rules);
    expect(c.stampDuty).toBe(700000);
    expect(c.registration).toBe(200000);
    expect(c.total).toBe(10915000);
  });
  it("charges duties on the guideline value when it is higher than the price", () => {
    const c = purchaseCost({ asking_price: 5000000, guideline_value: 6000000 }, rules);
    expect(c.stampDuty).toBe(420000);
  });
});

describe("comparables", () => {
  const base = { property_type: "villa", location: "Avadi" };
  it("only compares the same location and type", () => {
    const p = { ...base, id: "a", asking_price: 1000000, built_area_sqft: 1000 };
    const pool = [
      p,
      { ...base, id: "b", asking_price: 2000000, built_area_sqft: 1000 },
      { ...base, id: "c", location: "Tambaram", asking_price: 9000000, built_area_sqft: 1000 },
    ];
    expect(comparablesFor(p, pool).count).toBe(1);
    expect(comparablesFor(p, pool).avgPpsf).toBe(2000);
  });
  it("does not score affordability without at least two comparables", () => {
    const p = { ...base, id: "a", asking_price: 1000000, built_area_sqft: 1000 };
    const s = dealScore(p, [p], []);
    expect(s.parts.find((x) => x.key === "affordability")?.score).toBeNull();
  });
});
