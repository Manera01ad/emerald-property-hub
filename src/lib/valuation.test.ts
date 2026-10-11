import { describe, expect, it } from "vitest";
import { evidenceFlags, valueProperty } from "./valuation";

describe("valuation", () => {
  it("refuses an estimate with fewer than 2 comparables", () => {
    const v = valueProperty({ kind: "plot", area_sqft: 1200, comparables: [{ price: 3_000_000, area_sqft: 1000, kind: "asking" }] });
    expect(v.mid).toBeNull();
    expect(v.confidence).toBe("insufficient");
  });
  it("discounts asking prices by 5% and uses the median", () => {
    const v = valueProperty({ kind: "plot", area_sqft: 1000, comparables: [
      { price: 3_000_000, area_sqft: 1000, kind: "asking" },
      { price: 4_000_000, area_sqft: 1000, kind: "asking" },
    ] });
    expect(Math.round(v.mid!)).toBe(3_325_000);
    expect(v.low!).toBeLessThan(v.mid!);
    expect(v.high!).toBeGreaterThan(v.mid!);
  });
  it("guideline value alone is only a floor reference", () => {
    const v = valueProperty({ kind: "plot", area_sqft: 1000, guideline_value_per_sqft: 2000, comparables: [] });
    expect(v.low).toBe(2_000_000);
    expect(v.mid).toBeNull();
  });
  it("flags RERA claimed without a number", () => {
    expect(evidenceFlags({ property_type: "apartment", approvals: ["RERA"], built_area_sqft: 900 })).toContain("RERA claimed but no registration number given");
  });
});
