import { describe, it, expect } from "vitest";
import { expectedCommission } from "./commission";

describe("expectedCommission", () => {
  it("uses percent of deal value", () => expect(expectedCommission({ commission_pct: 2, deal_value: 5000000 })).toBe(100000));
  it("fixed amount overrides percent", () => expect(expectedCommission({ fixed_amount: 75000, commission_pct: 2, deal_value: 5000000 })).toBe(75000));
  it("unknown without terms", () => expect(expectedCommission({ deal_value: 5000000 })).toBeNull());
});
