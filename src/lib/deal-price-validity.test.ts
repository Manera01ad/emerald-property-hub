import { describe, expect, it } from "vitest";
import { comparablesFor, dealScore, pricePerSqft, type DealProperty } from "./deal";
import { priceContext } from "./price-context";

const listing = (id: string, transaction_type = "buy") => ({
  id,
  transaction_type,
  property_type: "apartment",
  location: "Velachery",
  asking_price: transaction_type === "buy" ? 8_000_000 : 25_000,
  built_area_sqft: 1000,
});

const unusable = [
  { asking_price: 0 },
  { asking_price: -1 },
  { asking_price: Number.NaN },
  { asking_price: Number.POSITIVE_INFINITY },
  { built_area_sqft: 0 },
  { built_area_sqft: -1 },
  { built_area_sqft: Number.NaN },
  { built_area_sqft: Number.POSITIVE_INFINITY },
  // Finite operands can still produce a nonfinite or zero rate.
  { asking_price: Number.MAX_VALUE, built_area_sqft: Number.MIN_VALUE },
  { asking_price: Number.MIN_VALUE, built_area_sqft: Number.MAX_VALUE },
];

describe.each(["buy", "rent", "lease"])("usable %s comparison prices", (type) => {
  const subject = listing("subject", type);
  const pool = Array.from({ length: 5 }, (_, i) => listing(`comparable-${i}`, type));

  it.each(unusable)("excludes unusable figures %j from evidence", (fields) => {
    const invalid = { ...listing("invalid", type), ...fields };
    expect(pricePerSqft(invalid)).toBeNull();

    const mixed = [...pool.slice(0, 4), invalid];
    expect(comparablesFor(subject, mixed)).toMatchObject({
      count: 4,
      avgPpsf: subject.asking_price / 1000,
      deltaPct: null,
      evidence: "UNKNOWN",
    });
    expect(priceContext(mixed, type as "buy" | "rent" | "lease")).toMatchObject({
      listings: 4,
      medianPpsf: null,
      rangePpsf: null,
      evidence: "UNKNOWN",
    });
  });

  it.each(unusable)("does not score an unusable subject %j", (fields) => {
    const invalid = { ...subject, ...fields };
    expect(comparablesFor(invalid, pool).deltaPct).toBeNull();
    expect(
      dealScore(invalid, pool, []).parts.find((part) => part.key === "affordability"),
    ).toMatchObject({
      score: null,
      evidence: "UNKNOWN",
      reason: "This listing has no usable price per sq ft to compare.",
    });
  });

  it("preserves estimates when five usable comparables remain", () => {
    const mixed = [
      ...pool,
      ...unusable.map((fields, i) => ({
        ...listing(`invalid-${i}`, type),
        ...fields,
      })),
    ];
    expect(comparablesFor(subject, mixed)).toMatchObject({
      count: 5,
      avgPpsf: subject.asking_price / 1000,
      deltaPct: 0,
      evidence: "ESTIMATE",
    });
    expect(priceContext(mixed, type as "buy" | "rent" | "lease")).toMatchObject({
      listings: 5,
      medianPpsf: subject.asking_price / 1000,
      evidence: "ESTIMATE",
    });
  });
});

it("preserves numeric database strings and plot land-area selection", () => {
  const row = {
    ...listing("plot"),
    property_type: "plot",
    asking_price: "2400000",
    land_area_sqft: "1200",
    built_area_sqft: 0,
  } as unknown as DealProperty;
  expect(pricePerSqft(row)).toBe(2000);
  expect(pricePerSqft({ ...listing("house"), built_area_sqft: null, land_area_sqft: 2000 })).toBe(
    4000,
  );
});
