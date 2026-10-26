import { describe, expect, it } from "vitest";
import { AREAS, CITIES, areaPoint } from "./areas";

describe("areas", () => {
  it("provides all 45 Chennai areas for area intelligence", () => {
    expect(Object.keys(AREAS["Chennai"] ?? {})).toHaveLength(45);
  });
  it("every area has coordinates inside the Chennai region", () => {
    for (const [name, p] of Object.entries(AREAS["Chennai"] ?? {})) {
      expect(p.lat, name).toBeGreaterThan(12.7);
      expect(p.lat, name).toBeLessThan(13.3);
      expect(p.lng, name).toBeGreaterThan(79.95);
      expect(p.lng, name).toBeLessThan(80.35);
    }
  });
  it("covers the site's launch markets", () => {
    for (const m of ["Guduvancheri", "Potheri", "Maraimalai Nagar", "Avadi", "Pattabiram", "Poonamallee", "Thiruverkkadu", "Tambaram"]) {
      expect(areaPoint("Chennai", m), m).not.toBeNull();
    }
  });
  it("returns null for unknown places", () => {
    expect(areaPoint("Chennai", "Nowhere")).toBeNull();
    expect(CITIES).toContain("Chennai");
  });
});
