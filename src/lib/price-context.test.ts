import { describe, expect, it } from "vitest";
import { priceContext } from "./price-context";
import { MIN_COMPARABLES } from "./deal";

const listing = (id: string, price: number, area: number) => ({ id, property_type: "villa", location: "Tambaram", asking_price: price, built_area_sqft: area });
const listings = (n: number) => Array.from({ length: n }, (_, i) => listing(`l${i}`, 2_000_000, 1000));

describe("locality price context", () => {
  it("is UNKNOWN with no listings", () => {
    const p = priceContext([]);
    expect(p.evidence).toBe("UNKNOWN");
    expect(p.medianPpsf).toBeNull();
  });

  it("stays UNKNOWN below the comparables minimum, and says why", () => {
    const p = priceContext(listings(MIN_COMPARABLES - 1));
    expect(p.evidence).toBe("UNKNOWN");
    expect(p.medianPpsf).toBeNull();
    expect(p.reason).toContain(String(MIN_COMPARABLES - 1));
  });

  it("is an ESTIMATE at the minimum, with a median and range", () => {
    const p = priceContext(listings(MIN_COMPARABLES));
    expect(p.evidence).toBe("ESTIMATE");
    expect(p.medianPpsf).toBe(2000);
    expect(p.rangePpsf).toEqual({ low: 2000, high: 2000 });
    expect(p.reason).toContain("claims by sellers");
  });

  it("ignores listings without a usable area", () => {
    const p = priceContext([...listings(MIN_COMPARABLES), { ...listing("noarea", 2_000_000, 0) }]);
    expect(p.listings).toBe(MIN_COMPARABLES);
  });
});
