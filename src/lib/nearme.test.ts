import { describe, expect, it } from "vitest";
import { areaCentre, listingDistance, nearMe, type NearListing, type NearObservation } from "./nearme";

const origin = { lat: 12.9249, lng: 80.1 }; // Tambaram
const listing = (o: Partial<NearListing> = {}): NearListing => ({ id: "l1", title: "Villa", property_type: "villa", location: "Tambaram", address: null, asking_price: 6_000_000, bedrooms: 3,
  built_area_sqft: 1500, land_area_sqft: 2400, status: "draft", latitude: 12.93, longitude: 80.11, ...o });
const obs = (o: Partial<NearObservation> = {}): NearObservation => ({ id: "o1", title: "Flat", property_type: "apartment", location: "Chromepet", address: null, asking_price: 4_500_000, bedrooms: 2,
  built_area_sqft: 900, land_area_sqft: null, source_url: "https://example.com/x", seller_name: null, quality_flags: [], property_id: null, duplicate_of_property: null, duplicate_of_observation: null, missing_since: null, ...o });
const f = { origin, radiusKm: 10 };

describe("nearMe", () => {
  it("matches area names case-insensitively and rejects unknown ones", () => {
    expect(areaCentre("TAMBARAM")?.name).toBe("Tambaram");
    expect(areaCentre("Nowhere")).toBeNull();
  });
  it("uses exact coordinates for listings and area centres for observations, nearest first", () => {
    const r = nearMe([listing()], [obs()], f);
    expect(r.items.map((i) => i.kind)).toEqual(["listing", "observed"]);
    expect(r.items[0]!.exact).toBe(true);
    expect(r.items[1]!.exact).toBe(false);
    expect(r.items[0]!.km).toBeLessThan(r.items[1]!.km);
  });
  it("drops anything outside the radius", () => {
    expect(nearMe([listing({ latitude: 13.08, longitude: 80.27 })], [], f).items).toHaveLength(0);
  });
  it("hides duplicates, ones already listed and ones the source no longer offers; counts unmatched areas", () => {
    const r = nearMe([], [obs({ id: "a", property_id: "x" }), obs({ id: "b", duplicate_of_property: "y" }), obs({ id: "c", missing_since: "2026-10-01" }), obs({ id: "d", location: "Mars" }), obs({ id: "e" })], f);
    expect(r.items).toHaveLength(1);
    expect(r.hiddenObservations).toBe(3);
    expect(r.unmatchedObservations).toBe(1);
  });
  it("applies type, budget and bedroom filters, and skips archived listings", () => {
    const rs = nearMe([listing(), listing({ id: "l2", status: "archived" })], [obs()], { ...f, type: "villa", maxPrice: 7_000_000, minBedrooms: 3 });
    expect(rs.items).toHaveLength(1);
    expect(nearMe([listing()], [], { ...f, maxPrice: 1_000_000 }).items).toHaveLength(0);
  });
  it("falls back to the area centre for a listing without coordinates", () => {
    const r = nearMe([listing({ latitude: null, longitude: null })], [], f);
    expect(r.items[0]!.exact).toBe(false);
  });
});

describe("listingDistance", () => {
  it("is exact with coordinates, area-level without, unknown for unrecognised areas", () => {
    expect(listingDistance({ latitude: 12.93, longitude: 80.11, location: "Tambaram" }, origin)!.exact).toBe(true);
    expect(listingDistance({ latitude: null, longitude: null, location: "Tambaram" }, origin)!.exact).toBe(false);
    expect(listingDistance({ latitude: null, longitude: null, location: "Mars" }, origin)).toBeNull();
  });
});
