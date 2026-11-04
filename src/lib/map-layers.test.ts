import { describe, expect, it } from "vitest";
import { mapLayers } from "./map-layers";

describe("keyless map views", () => {
  it("uses OpenStreetMap for Roadmap", () => {
    expect(mapLayers("roadmap")[0]?.url).toBe("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
  });
  it("uses Esri World Imagery for Satellite", () => {
    expect(mapLayers("satellite")).toHaveLength(1);
    expect(mapLayers("satellite")[0]?.url).toContain("World_Imagery/MapServer/tile/{z}/{y}/{x}");
  });
  it("adds place labels over imagery for Hybrid", () => {
    expect(mapLayers("hybrid")).toHaveLength(2);
    expect(mapLayers("hybrid")[0]).toEqual(mapLayers("satellite")[0]);
    expect(mapLayers("hybrid")[1]?.url).toContain("World_Boundaries_and_Places");
  });
  it("uses topographic tiles for Terrain without a key", () => {
    expect(mapLayers("terrain")[0]?.url).toContain("World_Topo_Map");
    for (const view of ["roadmap", "satellite", "hybrid", "terrain"] as const) {
      for (const layer of mapLayers(view)) expect(layer.url).not.toMatch(/google|key=|token=/);
    }
  });
});