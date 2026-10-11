import { describe, it, expect } from "vitest";
import { expectedCommission } from "./commission";

describe("expectedCommission", () => {
  it("uses percent of deal value", () => expect(expectedCommission({ commission_pct: 2, deal_value: 5000000 })).toBe(100000));
  it("fixed amount overrides percent", () => expect(expectedCommission({ fixed_amount: 75000, commission_pct: 2, deal_value: 5000000 })).toBe(75000));
  it("unknown without terms", () => expect(expectedCommission({ deal_value: 5000000 })).toBeNull());
});

describe("commission edge cases", () => {
  it("zero fixed amount falls back to percentage", () => {
    expect(expectedCommission({ fixed_amount: 0, commission_pct: 2, deal_value: 5000000 })).toBe(100000);
  });
  it("zero percent gives zero", () => {
    expect(expectedCommission({ commission_pct: 0, deal_value: 5000000 })).toBe(0);
  });
  it("percent without sale value is unknown", () => {
    expect(expectedCommission({ commission_pct: 2 })).toBeNull();
  });
  it("no terms is unknown", () => {
    expect(expectedCommission({})).toBeNull();
  });
});
