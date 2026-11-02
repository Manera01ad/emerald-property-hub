import { describe, expect, it } from "vitest";
import { compareLocalities } from "./locality-compare";
import { summariseArea } from "./area-intel";
import type { DealProperty } from "./deal";

const summary = summariseArea(
  [
    { type: "node", id: 1, lat: 12.846, lon: 80.06, tags: { highway: "bus_stop", name: "Stop" } },
    { type: "node", id: 2, lat: 12.85, lon: 80.06, tags: { railway: "station", name: "Guduvancheri" } },
  ],
  12.845, 80.06, 39,
);
const listing = (id: string, price: number): DealProperty =>
  ({ id, property_type: "apartment", location: "Guduvancheri", asking_price: price, built_area_sqft: 1000, land_area_sqft: null, guideline_value: null } as unknown as DealProperty);

describe("locality comparison", () => {
  const rows = compareLocalities([
    { name: "Guduvancheri", summary, listings: [] },
    { name: "Tambaram", summary: null, listings: [] },
  ]);
  const row = (k: string) => rows.find((r) => r.key === k)!;

  it("builds one cell per locality for flood, transport and price rows", () => {
    expect(rows.every((r) => r.cells.length === 2)).toBe(true);
    expect(rows.map((r) => r.group)).toEqual(expect.arrayContaining(["Flood and drainage", "Transport", "Asking prices"]));
  });

  it("labels held open data as estimates", () => {
    expect(row("flood-elevation").cells[0]).toMatchObject({ value: "39 m", evidence: "ESTIMATE" });
    expect(row("transport-bus").cells[0]?.value).toMatch(/^1 within 1 km/);
    expect(row("transport-rail").cells[0]?.value).toMatch(/Guduvancheri · /);
    expect(row("transport-metro").cells[0]?.value).toBe("None mapped within 3 km");
  });

  it("reads Unknown everywhere for a locality with no snapshot, never zero", () => {
    for (const r of rows) {
      if (r.group === "Asking prices") continue;
      expect(r.cells[1]).toMatchObject({ value: "Unknown", evidence: "UNKNOWN" });
    }
  });

  it("shows no price figure until there are enough listings, then an estimate", () => {
    expect(row("price-sale").cells[0]).toMatchObject({ value: "No figure", evidence: "UNKNOWN" });
    const many = compareLocalities([{ name: "Guduvancheri", summary, listings: [1, 2, 3, 4, 5].map((i) => listing(`p${i}`, 5_000_000 + i * 100_000)) }]);
    const cell = many.find((r) => r.key === "price-sale")!.cells[0]!;
    expect(cell.evidence).toBe("ESTIMATE");
    expect(cell.value).toMatch(/\/sq ft median/);
  });
});
