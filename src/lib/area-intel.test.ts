import { describe, expect, it } from "vitest";
import { distanceKm, elevationNote, summariseArea, type OsmElement } from "./area-intel";

const C = { lat: 12.845, lng: 80.06 };

describe("area intelligence", () => {
  it("measures straight-line distance (1° latitude ≈ 111 km)", () => {
    expect(Math.round(distanceKm(12, 80, 13, 80))).toBe(111);
  });

  it("sorts groups by distance, keeps the nearest and counts each OSM object once", () => {
    const els: OsmElement[] = [
      { type: "way", id: 1, center: { lat: 12.855, lon: 80.06 }, tags: { natural: "water", name: "Far Lake" } },
      { type: "way", id: 2, center: { lat: 12.846, lon: 80.06 }, tags: { natural: "water", name: "Near Tank" } },
      { type: "way", id: 2, center: { lat: 12.846, lon: 80.06 }, tags: { natural: "water", name: "Near Tank" } },
      { type: "node", id: 3, lat: 12.845, lon: 80.061, tags: { highway: "bus_stop" } },
      { type: "node", id: 4, lat: 12.85, lon: 80.06, tags: { railway: "station", name: "Guduvancheri" } },
      { type: "node", id: 5, lat: 12.85, lon: 80.07, tags: { public_transport: "station", station: "subway", railway: "station", name: "Metro X" } },
    ];
    const s = summariseArea(els, C.lat, C.lng, 40);
    expect(s.water.count).toBe(2);
    expect(s.water.nearest?.name).toBe("Near Tank");
    expect(s.transport.bus_stops).toBe(1);
    expect(s.transport.rail.count).toBe(1);
    expect(s.transport.metro.nearest?.name).toBe("Metro X");
    expect(s.parks.nearest).toBeNull();
  });

  it("never presents height as a flood verdict", () => {
    expect(elevationNote(5)).toMatch(/Low-lying/);
    expect(elevationNote(30)).toMatch(/does not rule out/);
    expect(elevationNote(null)).toMatch(/not available/);
  });
});
