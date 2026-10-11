import { describe, it, expect } from "vitest";
import { analyse, classifyPriceChange, isLikelyDuplicate, normaliseItem, qualityCheck } from "./core";
import { fixtureListings } from "./fixture";

const rates = { stampDutyPct: 7, registrationPct: 2, legalFee: 15000 };

describe("research engine", () => {
  it("extracts Indian-format prices and maps 'Flat' to apartment", () => {
    const n = normaliseItem({ id: "x", price: "52,00,000", type: "Flat" })!;
    expect(n.asking_price).toBe(5200000);
    expect(n.property_type).toBe("apartment");
  });
  it("ignores items without a stable id", () => {
    expect(normaliseItem({ title: "no id" })).toBeNull();
  });
  it("classifies price changes", () => {
    expect(classifyPriceChange(100, 90)).toBe("reduction");
    expect(classifyPriceChange(100, 110)).toBe("increase");
    expect(classifyPriceChange(100, 100)).toBeNull();
    expect(classifyPriceChange(null, 100)).toBeNull();
  });
  it("detects the fixture repost as a duplicate", () => {
    const all = fixtureListings("a").map((x) => normaliseItem(x)!);
    const b = all[2]!, repost = all[5]!;
    expect(isLikelyDuplicate({ id: "1", ...b }, { id: "2", ...repost })).toBe(true);
  });
  it("different RERA numbers are never duplicates", () => {
    const all = fixtureListings("a").map((x) => normaliseItem(x)!);
    expect(isLikelyDuplicate({ id: "1", ...all[1]!, asking_price: 4950000 }, { id: "2", ...all[2]!, asking_price: 5000000 })).toBe(false);
  });
  it("does not match different localities", () => {
    const n = normaliseItem(fixtureListings("a")[0]!)!;
    expect(isLikelyDuplicate({ id: "1", ...n }, { id: "2", ...n, location: "Tambaram" })).toBe(false);
  });
  it("quarantines a listing with no price", () => {
    const r = qualityCheck({ id: "1", property_type: "plot", location: "Tambaram", asking_price: null, source_url: "u" }, []);
    expect(r.quarantine).toBe(true);
    expect(r.flags).toContain("missing_price");
  });
  it("score is unavailable with fewer than 2 comparables", () => {
    const a = analyse({ id: "1", property_type: "villa", location: "X", asking_price: 1e7, built_area_sqft: 1000 }, [], null, rates);
    expect(a.score).toBeNull();
    expect(a.price_per_sqft).toBe(10000);
    expect(a.estimated_total_cost).toBe(10915000);
  });
});

import { applyMapping, parseCsv } from "./core";
describe("feed onboarding helpers", () => {
  it("parses quoted CSV with commas, quotes and CRLF", () => {
    const rows = parseCsv('ref,Price,Name\r\nA1,"52,00,000","Villa ""East"""\r\nA2,4800000,Plot\r\n');
    expect(rows).toEqual([{ ref: "A1", Price: "52,00,000", Name: 'Villa "East"' }, { ref: "A2", Price: "4800000", Name: "Plot" }]);
  });
  it("maps source columns onto PropWise fields so listings normalise", () => {
    const n = normaliseItem(applyMapping({ ref: "A1", Price: "52,00,000", Kind: "Flat" }, { id: "ref", price: "Price", property_type: "Kind" }));
    expect(n?.external_id).toBe("A1");
    expect(n?.asking_price).toBe(5200000);
    expect(n?.property_type).toBe("apartment");
  });
  it("rows without a mapped id are ignored", () => {
    expect(normaliseItem(applyMapping({ ref: "" }, { id: "ref" }))).toBeNull();
  });
});
