import { describe, expect, it } from "vitest";
import { findLocality, groupByCorridor, sortLocalities, visibleLocalities, type Locality } from "./localities";

const row = (over: Partial<Locality>): Locality => ({
  id: over.slug ?? "x", slug: "x", name: "X", city: "Chennai", state: "Tamil Nadu",
  corridor: "GST Road", tier: 2, status: "active", latitude: null, longitude: null, ...over,
});

const rows: Locality[] = [
  row({ id: "1", slug: "tambaram", name: "Tambaram", tier: 1, corridor: "GST Road" }),
  row({ id: "2", slug: "avadi", name: "Avadi", tier: 2, corridor: "Poonamallee–Avadi Road" }),
  row({ id: "3", slug: "potheri", name: "Potheri", tier: 2, corridor: "GST Road" }),
  row({ id: "4", slug: "hidden-area", name: "Hidden Area", status: "hidden", corridor: "GST Road" }),
];

describe("localities", () => {
  it("hides non-active localities from buyers", () => {
    expect(visibleLocalities(rows).map((r) => r.slug)).toEqual(["tambaram", "avadi", "potheri"]);
  });

  it("orders tier 1 first, then by name, so the pilot leads", () => {
    expect(sortLocalities(rows).map((r) => r.name)).toEqual(["Tambaram", "Avadi", "Hidden Area", "Potheri"]);
  });

  it("groups by corridor in the same order", () => {
    const groups = groupByCorridor(visibleLocalities(rows));
    expect(groups.map((g) => g.corridor)).toEqual(["GST Road", "Poonamallee–Avadi Road"]);
    expect(groups[0]?.localities.map((l) => l.name)).toEqual(["Tambaram", "Potheri"]);
  });

  it("finds by slug and returns null for an unknown one", () => {
    expect(findLocality(rows, "potheri")?.name).toBe("Potheri");
    expect(findLocality(rows, "nowhere")).toBeNull();
  });
});
