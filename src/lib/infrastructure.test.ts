import { describe, expect, it } from "vitest";
import {
  INFRA_STATUS_LABELS,
  OTHER_AREA,
  areaOptions,
  groupByArea,
  infraStatusLabel,
  isKnownArea,
} from "./infrastructure";

describe("infraStatusLabel", () => {
  it("uses buyer-facing words for every stored status", () => {
    expect(infraStatusLabel("completed")).toBe("Open");
    expect(infraStatusLabel("under_construction")).toBe("Under construction");
    expect(infraStatusLabel("announced")).toBe("Planned");
    expect(infraStatusLabel("approved")).toBe("Planned");
    expect(infraStatusLabel("stalled")).toBe("Stalled");
  });

  it("covers every value the database constraint allows", () => {
    // Mirrors the CHECK constraint on infrastructure_projects.progress_status.
    for (const s of ["announced", "approved", "under_construction", "completed", "stalled"]) {
      expect(INFRA_STATUS_LABELS[s], s).toBeTruthy();
    }
  });

  it("falls back to humanized text for an unknown status", () => {
    expect(infraStatusLabel("some_new_state")).toBe("Some new state");
  });
});

describe("groupByArea", () => {
  it("groups rows by area, alphabetically, with other areas last", () => {
    const rows = [
      { area: "Velachery", name: "c" },
      { area: "Avadi", name: "a" },
      { area: null, name: "d" },
      { area: "Avadi", name: "b" },
    ];
    const groups = groupByArea(rows);
    expect(groups.map((g) => g.area)).toEqual(["Avadi", "Velachery", OTHER_AREA]);
    expect(groups[0]!.projects.map((p) => p.name)).toEqual(["a", "b"]);
  });

  it("keeps rows with a blank or whitespace area visible", () => {
    const groups = groupByArea([{ area: "  " }, { area: "" }]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.area).toBe(OTHER_AREA);
    expect(groups[0]!.projects).toHaveLength(2);
  });

  it("returns nothing for no rows", () => {
    expect(groupByArea([])).toEqual([]);
  });
});

describe("areaOptions", () => {
  it("returns the shared area list, sorted, containing the launch markets", () => {
    const opts = areaOptions();
    expect(opts).toContain("Poonamallee");
    expect(opts).toContain("Vadapalani");
    expect(opts).toContain("Porur");
    expect(opts).toEqual([...opts].sort((a, b) => a.localeCompare(b)));
  });

  it("recognises known areas and rejects unknown ones", () => {
    expect(isKnownArea("Poonamallee")).toBe(true);
    expect(isKnownArea("Nowhere")).toBe(false);
  });
});
