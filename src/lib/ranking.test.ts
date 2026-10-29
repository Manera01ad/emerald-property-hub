import { describe, expect, it } from "vitest";
import {
  dataQuality, demandComponent, infrastructureComponent, MIN_DEMAND_EVIDENCE, MIN_PRICE_EVIDENCE,
  priceComponent, rankingInputsFor, rankLocality, riskFlag, supplyComponent, type RankingInputs,
} from "./ranking";

const inputs = (over: Partial<RankingInputs> = {}): RankingInputs => ({
  locality: "Tambaram", publishedListings: 0, priceComparables: 0, interestRequests: 0,
  publishedInfrastructure: 0, verifiedInfrastructure: 0, hasAreaSnapshot: false, ...over,
});

describe("ranking components", () => {
  it("treats thin demand as UNKNOWN, not as low demand", () => {
    const c = demandComponent(MIN_DEMAND_EVIDENCE - 1);
    expect(c.score).toBeNull();
    expect(c.evidence).toBe("UNKNOWN");
    expect(c.note).toContain(String(MIN_DEMAND_EVIDENCE));
  });

  it("scores demand once the floor is met, and calls it a claim", () => {
    const c = demandComponent(MIN_DEMAND_EVIDENCE);
    expect(c.score).toBe(50);
    expect(c.evidence).toBe("CLAIM");
    expect(demandComponent(20).score).toBe(100);
    expect(demandComponent(100).score).toBe(100);
  });

  it("treats thin price evidence as UNKNOWN", () => {
    expect(priceComponent(MIN_PRICE_EVIDENCE - 1).score).toBeNull();
    expect(priceComponent(MIN_PRICE_EVIDENCE).evidence).toBe("ESTIMATE");
    expect(priceComponent(MIN_PRICE_EVIDENCE).score).toBe(33);
  });

  it("reads supply only from published listings", () => {
    expect(supplyComponent(0).evidence).toBe("UNKNOWN");
    expect(supplyComponent(5).score).toBe(50);
    expect(supplyComponent(20).score).toBe(100);
  });

  it("scores infrastructure by confirmed progress only", () => {
    expect(infrastructureComponent(0, 0).evidence).toBe("UNKNOWN");
    expect(infrastructureComponent(4, 0).evidence).toBe("CLAIM");
    expect(infrastructureComponent(4, 0).score).toBe(0);
    expect(infrastructureComponent(4, 2).score).toBe(50);
    expect(infrastructureComponent(4, 2).evidence).toBe("VERIFIED");
  });

  it("never lets a verified count exceed the published count", () => {
    expect(infrastructureComponent(2, 9).score).toBe(100);
  });
});

describe("risk flag", () => {
  it("flags thin evidence and unconfirmed progress", () => {
    const r = riskFlag(inputs({ publishedInfrastructure: 3, verifiedInfrastructure: 1 }));
    expect(r.flagged).toBe(true);
    expect(r.reasons).toHaveLength(4);
  });

  it("stays clear when every signal is present and confirmed", () => {
    const r = riskFlag(inputs({ priceComparables: 6, interestRequests: 12, publishedInfrastructure: 2, verifiedInfrastructure: 2, hasAreaSnapshot: true }));
    expect(r.flagged).toBe(false);
    expect(r.reasons).toEqual([]);
  });
});

describe("data quality and ranking", () => {
  it("counts only components that meet their floor", () => {
    const q = dataQuality([demandComponent(0), supplyComponent(3), priceComponent(0), infrastructureComponent(0, 0)]);
    expect(q.known).toBe(1);
    expect(q.total).toBe(4);
    expect(q.evidence).toBe("UNKNOWN");
  });

  it("is an estimate only when every component is known", () => {
    const q = dataQuality([demandComponent(10), supplyComponent(3), priceComponent(5), infrastructureComponent(2, 2)]);
    expect(q.known).toBe(4);
    expect(q.evidence).toBe("ESTIMATE");
  });

  it("returns UNKNOWN for an empty component list", () => {
    expect(dataQuality([]).evidence).toBe("UNKNOWN");
  });

  it("ranks a locality with no evidence as unknown on every component", () => {
    const r = rankLocality(inputs());
    expect(r.components.map((c) => c.key)).toEqual(["D", "S", "P", "I"]);
    expect(r.components.every((c) => c.score === null)).toBe(true);
    expect(r.quality.evidence).toBe("UNKNOWN");
    expect(r.risk.flagged).toBe(true);
  });
});

describe("gathering inputs from rows", () => {
  const rows = {
    properties: [
      { id: "p1", location: "Tambaram", asking_price: 5_000_000, built_area_sqft: 1200, land_area_sqft: null },
      { id: "p2", location: "Tambaram", asking_price: 6_000_000, built_area_sqft: null, land_area_sqft: null },
      { id: "p3", location: "Avadi", asking_price: 4_000_000, built_area_sqft: 900, land_area_sqft: null },
    ],
    interestPropertyIds: ["p1", "p2", "p3", "p1"],
    projects: [
      { location: "Tambaram", verified: true },
      { location: "Tambaram", verified: false },
      { location: "Avadi", verified: true },
    ],
    snapshotAreas: ["Tambaram"],
  };

  it("counts only the locality's own rows", () => {
    const i = rankingInputsFor("Tambaram", rows);
    expect(i.publishedListings).toBe(2);
    expect(i.priceComparables).toBe(1);
    expect(i.interestRequests).toBe(3);
    expect(i.publishedInfrastructure).toBe(2);
    expect(i.verifiedInfrastructure).toBe(1);
    expect(i.hasAreaSnapshot).toBe(true);
  });

  it("returns empty inputs for a locality we hold nothing on", () => {
    const i = rankingInputsFor("Potheri", rows);
    expect(i.publishedListings).toBe(0);
    expect(i.interestRequests).toBe(0);
    expect(i.hasAreaSnapshot).toBe(false);
    expect(rankLocality(i).quality.evidence).toBe("UNKNOWN");
  });
});

describe("gathering inputs respects the transaction type", () => {
  const rows = {
    properties: [
      { id: "s1", location: "Tambaram", transaction_type: "buy", asking_price: 5_000_000, built_area_sqft: 1200, land_area_sqft: null },
      { id: "r1", location: "Tambaram", transaction_type: "rent", asking_price: 25_000, built_area_sqft: 1000, land_area_sqft: null },
      { id: "r2", location: "Tambaram", transaction_type: "rent", asking_price: 30_000, built_area_sqft: 1000, land_area_sqft: null },
      { id: "l1", location: "Tambaram", transaction_type: "lease", asking_price: 90_000, built_area_sqft: 2000, land_area_sqft: null },
    ],
    interestPropertyIds: [],
    projects: [],
    snapshotAreas: [],
  };

  it("counts only sale listings for a sale ranking", () => {
    const i = rankingInputsFor("Tambaram", rows, "buy");
    expect(i.publishedListings).toBe(1);
    expect(i.priceComparables).toBe(1);
  });

  it("counts only rentals for a rent ranking, and never the sale", () => {
    const i = rankingInputsFor("Tambaram", rows, "rent");
    expect(i.publishedListings).toBe(2);
    expect(i.priceComparables).toBe(2);
  });

  it("keeps a lease out of both the sale and the rent ranking", () => {
    expect(rankingInputsFor("Tambaram", rows, "buy").publishedListings).toBe(1);
    expect(rankingInputsFor("Tambaram", rows, "rent").publishedListings).toBe(2);
    expect(rankingInputsFor("Tambaram", rows, "lease").publishedListings).toBe(1);
  });

  it("defaults to sale when no type is given", () => {
    expect(rankingInputsFor("Tambaram", rows).publishedListings).toBe(1);
  });
});
