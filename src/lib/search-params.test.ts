import { describe, expect, it } from "vitest";
import { z } from "zod";
import { searchBoolean, searchEnum, searchInt, searchNumber, searchString } from "./search-params";

/**
 * The regression these helpers exist for: TanStack Router parses a query string
 * before `validateSearch` sees it, so `?area=123` reaches the schema as a number.
 * The route schema used to be `z.object({ area: z.string().optional() })`, which
 * rejected that with `expected string, received number`, threw during SSR, and
 * answered 500 for /explore, /location-intelligence and /properties.
 *
 * These tests assert the two properties that keep a page loading: a schema built
 * from these helpers never throws, and a well-formed value is still applied.
 */

// The shape the affected routes use, built the same way.
const routeSearch = z.object({
  area: searchString,
  transaction: searchEnum(["buy", "rent", "lease"] as const),
  minPrice: searchNumber,
  maxPrice: searchNumber,
  bedrooms: searchInt,
  minLand: searchInt,
  location: searchString,
  locality: searchString,
  type: searchString,
  approval: searchString,
  availability: searchString,
  allInclusive: searchBoolean,
  verifiedOnly: searchBoolean,
});

describe("tolerant search parameters", () => {
  it("never throws on malformed values, dropping each one", () => {
    const malformed = [
      { area: 123 },
      { transaction: "bogus" },
      { minPrice: "abc" },
      { maxPrice: "" },
      { bedrooms: "xyz" },
      { bedrooms: 2.5 },
      { minLand: "1e999" },
      { location: 42 },
      { type: ["villa"] },
      { approval: { nested: true } },
      { availability: null },
      { allInclusive: "yes" },
      { verifiedOnly: "on" },
    ];
    for (const value of malformed) {
      const parsed = routeSearch.safeParse(value);
      expect(parsed.success, JSON.stringify(value)).toBe(true);
      expect(parsed.data, JSON.stringify(value)).toEqual({});
    }
  });

  it("keeps well-formed values, coercing the numbers a URL carries as text", () => {
    expect(
      routeSearch.parse({
        area: "Adyar",
        transaction: "rent",
        minPrice: "50",
        maxPrice: 90,
        bedrooms: "3",
        minLand: 1200,
        location: "Adyar",
        allInclusive: true,
        verifiedOnly: "true",
      }),
    ).toEqual({
      area: "Adyar",
      transaction: "rent",
      minPrice: 50,
      maxPrice: 90,
      bedrooms: 3,
      minLand: 1200,
      location: "Adyar",
      allInclusive: true,
      verifiedOnly: true,
    });
  });

  it("treats an empty string as absent, not as zero", () => {
    expect(routeSearch.parse({ maxPrice: "", bedrooms: "" })).toEqual({});
  });

  it("rejects a non-finite number rather than passing Infinity into a filter", () => {
    expect(routeSearch.parse({ minPrice: "Infinity" })).toEqual({});
    expect(routeSearch.parse({ maxPrice: "-Infinity" })).toEqual({});
  });

  it("ignores a fractional bedroom count", () => {
    expect(routeSearch.parse({ bedrooms: 3.5 })).toEqual({});
    expect(routeSearch.parse({ bedrooms: "3" })).toEqual({ bedrooms: 3 });
  });

  it("reads a checkbox from every form a URL can carry it in", () => {
    expect(searchBoolean.parse("true")).toBe(true);
    expect(searchBoolean.parse("1")).toBe(true);
    expect(searchBoolean.parse("false")).toBe(false);
    expect(searchBoolean.parse("0")).toBe(false);
    expect(searchBoolean.parse(true)).toBe(true);
    expect(searchBoolean.parse("yes")).toBeUndefined();
    expect(searchBoolean.parse("")).toBeUndefined();
  });

  it("keeps only words the route allows", () => {
    const schema = z.object({ transaction: searchEnum(["buy", "rent", "lease"] as const) });
    expect(schema.parse({ transaction: "lease" })).toEqual({ transaction: "lease" });
    expect(schema.parse({ transaction: "BUY" })).toEqual({});
    expect(schema.parse({ transaction: "bogus" })).toEqual({});
  });

  it("does not treat an unrelated key as an error", () => {
    expect(routeSearch.safeParse({ utm_source: "newsletter", area: "Adyar" }).success).toBe(true);
  });
});
