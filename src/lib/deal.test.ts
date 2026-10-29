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
  const pool = (n: number, location = "Avadi") =>
    Array.from({ length: n }, (_, i) => ({ property_type: "villa", location, id: `c${i}`, asking_price: 2000000, built_area_sqft: 1000 }));
  const subject = { ...base, id: "a", asking_price: 1000000, built_area_sqft: 1000 };

  it("only compares the same location and type", () => {
    const mixed = [
      subject,
      { ...base, id: "b", asking_price: 2000000, built_area_sqft: 1000 },
      { ...base, id: "c", location: "Tambaram", asking_price: 9000000, built_area_sqft: 1000 },
    ];
    expect(comparablesFor(subject, mixed).count).toBe(1);
    expect(comparablesFor(subject, mixed).avgPpsf).toBe(2000);
  });

  it("stays UNKNOWN with no comparables", () => {
    const c = comparablesFor(subject, [subject]);
    expect(c.count).toBe(0);
    expect(c.avgPpsf).toBeNull();
    expect(c.deltaPct).toBeNull();
    expect(c.evidence).toBe("UNKNOWN");
  });

  it("stays UNKNOWN with four comparables", () => {
    const c = comparablesFor(subject, [subject, ...pool(4)]);
    expect(c.count).toBe(4);
    expect(c.deltaPct).toBeNull();
    expect(c.evidence).toBe("UNKNOWN");
  });

  it("becomes an ESTIMATE at five comparables", () => {
    const c = comparablesFor(subject, [subject, ...pool(5)]);
    expect(c.count).toBe(5);
    expect(c.avgPpsf).toBe(2000);
    expect(c.deltaPct).toBeCloseTo(-50, 5);
    expect(c.evidence).toBe("ESTIMATE");
  });

  it("ignores near-miss location strings", () => {
    const c = comparablesFor(subject, [subject, ...pool(5, "Avadi "), ...pool(5, "avadi")]);
    expect(c.count).toBe(0);
    expect(c.evidence).toBe("UNKNOWN");
  });

  it("does not score affordability below the comparables minimum", () => {
    const s = dealScore(subject, [subject, ...pool(4)], []);
    const part = s.parts.find((x) => x.key === "affordability");
    expect(part?.score).toBeNull();
    expect(part?.evidence).toBe("UNKNOWN");
  });

  it("scores affordability once there are enough comparables", () => {
    const s = dealScore(subject, [subject, ...pool(5)], []);
    const part = s.parts.find((x) => x.key === "affordability");
    expect(part?.evidence).toBe("ESTIMATE");
    expect(part?.score).not.toBeNull();
  });
});

describe("comparables stay within one transaction type", () => {
  const rent = (id: string) => ({ property_type: "apartment", location: "Velachery", id, transaction_type: "rent", asking_price: 25000, built_area_sqft: 1000 });
  const sale = (id: string) => ({ property_type: "apartment", location: "Velachery", id, transaction_type: "buy", asking_price: 8000000, built_area_sqft: 1000 });

  it("does not compare a rental against sale prices", () => {
    // Four sale comparables exist, but a rent is not comparable with a sale, so this is UNKNOWN.
    const c = comparablesFor(rent("r"), [rent("r"), sale("s1"), sale("s2"), sale("s3"), sale("s4"), sale("s5")]);
    expect(c.count).toBe(0);
    expect(c.evidence).toBe("UNKNOWN");
    expect(c.avgPpsf).toBeNull();
  });

  it("does not compare a sale against monthly rents", () => {
    const c = comparablesFor(sale("s"), [sale("s"), rent("r1"), rent("r2"), rent("r3"), rent("r4"), rent("r5")]);
    expect(c.count).toBe(0);
    expect(c.evidence).toBe("UNKNOWN");
  });

  it("compares rentals with rentals once the minimum is met", () => {
    const pool = Array.from({ length: 5 }, (_, i) => rent(`r${i}`));
    const c = comparablesFor({ ...rent("r"), asking_price: 20000 }, [rent("r"), ...pool]);
    expect(c.count).toBe(5);
    expect(c.avgPpsf).toBe(25);
    expect(c.evidence).toBe("ESTIMATE");
  });

  it("treats a listing with no transaction type as a sale", () => {
    const legacy = { property_type: "apartment", location: "Velachery", id: "old", asking_price: 8000000, built_area_sqft: 1000 };
    const pool = Array.from({ length: 5 }, (_, i) => ({ ...legacy, id: `old${i}` }));
    expect(comparablesFor(legacy, [legacy, ...pool]).count).toBe(5);
  });
});
