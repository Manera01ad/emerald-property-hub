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

describe("price context stays within one transaction type", () => {
  const rents = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `r${i}`, property_type: "villa", location: "Tambaram", transaction_type: "rent", asking_price: 25000, built_area_sqft: 1000 }));

  it("ignores rentals when the context is a sale", () => {
    const p = priceContext(rents(MIN_COMPARABLES), "buy");
    expect(p.evidence).toBe("UNKNOWN");
    expect(p.listings).toBe(0);
  });

  it("reads a rental market from rentals, in monthly terms", () => {
    const p = priceContext(rents(MIN_COMPARABLES), "rent");
    expect(p.evidence).toBe("ESTIMATE");
    expect(p.medianPpsf).toBe(25);
    expect(p.reason).toContain("monthly rent");
  });

  it("does not mix rents and sales in one median", () => {
    const mixed = [...rents(MIN_COMPARABLES), ...listings(MIN_COMPARABLES)];
    const p = priceContext(mixed, "rent");
    expect(p.listings).toBe(MIN_COMPARABLES);
    expect(p.medianPpsf).toBe(25);
  });

  it("defaults to sale when no type is given", () => {
    expect(priceContext(listings(MIN_COMPARABLES)).medianPpsf).toBe(2000);
  });
});
