import { describe, expect, it } from "vitest";
import { bboxKey, distanceKm, layerForTags, layerScore, livability, overpassBboxQuery, parseOverpass, snapBbox, walkMinutes } from "./livability";

describe("layerForTags", () => {
  it("maps OSM tags to layers", () => {
    expect(layerForTags({ amenity: "school" })).toBe("school");
    expect(layerForTags({ amenity: "clinic" })).toBe("hospital");
    expect(layerForTags({ shop: "supermarket" })).toBe("grocery");
    expect(layerForTags({ highway: "bus_stop" })).toBe("transit");
    expect(layerForTags({ amenity: "cafe" })).toBe("food");
  });
  it("ignores everything else", () => {
    expect(layerForTags({ amenity: "bench" })).toBeNull();
    expect(layerForTags(undefined)).toBeNull();
  });
});

describe("layerScore", () => {
  it("is full when close, zero when far or missing, linear between", () => {
    expect(layerScore(0.2, "school")).toBe(1);
    expect(layerScore(3, "school")).toBe(0);
    expect(layerScore(undefined, "school")).toBe(0);
    expect(layerScore(1.75, "school")).toBeCloseTo(0.5, 5);
  });
});

describe("parseOverpass + livability", () => {
  const els = [
    { type: "node", id: 1, lat: 12.84, lon: 80.06, tags: { amenity: "school", name: "ABC School" } },
    { type: "way", id: 2, center: { lat: 12.85, lon: 80.07 }, tags: { shop: "supermarket" } },
    { type: "node", id: 3, lat: 12.84, lon: 80.06, tags: { amenity: "bench" } },
    { type: "node", id: 4, tags: { amenity: "school" } },
  ];
  it("keeps only usable elements, sorted by distance", () => {
    const pois = parseOverpass(els, 12.84, 80.06);
    expect(pois).toHaveLength(2);
    expect(pois[0]!.name).toBe("ABC School");
    expect(pois[0]!.km).toBeCloseTo(0, 3);
  });
  it("scores 0 with nothing nearby and rewards what is close", () => {
    expect(livability([]).score).toBe(0);
    const l = livability(parseOverpass(els, 12.84, 80.06));
    expect(l.counts.school).toBe(1);
    expect(l.score).toBeGreaterThan(20);
    expect(l.score).toBeLessThanOrEqual(100);
  });
});

describe("distance helpers", () => {
  it("haversine is about right for ~1 degree of latitude", () => {
    expect(distanceKm(13, 80, 14, 80)).toBeCloseTo(111.2, 0);
  });
  it("walk time is at least a minute", () => {
    expect(walkMinutes(0.01)).toBe(1);
    expect(walkMinutes(0.48)).toBe(6);
  });
});

describe("map-view lookups", () => {
  it("snaps outward to a 0.01 degree grid so small pans share a key", () => {
    const a = snapBbox({ south: 12.9234, west: 80.0912, north: 12.9561, east: 80.1288 });
    expect(a).toEqual({ south: 12.92, west: 80.09, north: 12.96, east: 80.13 });
    const b = snapBbox({ south: 12.9261, west: 80.0955, north: 12.9549, east: 80.1201 });
    expect(bboxKey(b)).toBe(bboxKey(a));
  });
  it("builds a query for all five layers inside the box", () => {
    const q = overpassBboxQuery({ south: 12.92, west: 80.09, north: 12.96, east: 80.13 });
    expect(q).toContain("(12.92,80.09,12.96,80.13)");
    for (const tag of ["school", "supermarket", "railway=station", "bus_stop"]) expect(q).toContain(tag);
    expect(q).toContain("out center 500");
  });
});
