import { describe, expect, it } from "vitest";
import { floodBrief, floodBriefIsEmpty, type FloodInput } from "./flood";

const base: FloodInput = { elevation_m: null, mappedWaterCount: null, nearestWaterKm: null, officialZone: null };

describe("flood brief", () => {
  it("states nothing when we hold no data — every fact unknown", () => {
    const b = floodBrief(base);
    expect(floodBriefIsEmpty(b)).toBe(true);
    for (const f of b.facts) {
      expect(f.value).toBeNull();
      expect(f.evidence).toBe("UNKNOWN");
    }
    expect(b.unknowns).toContain("Whether an official flood map covers this area");
    expect(b.groundChecks.length).toBeGreaterThan(0);
    expect(b.caveats.length).toBeGreaterThan(0);
  });

  it("labels held data honestly: elevation and water are estimates, the official zone carries its source", () => {
    const b = floodBrief({
      elevation_m: 9.4,
      mappedWaterCount: 14,
      nearestWaterKm: 0.4,
      officialZone: { label: "Inundation-prone in the 2015 flood atlas", source: "Institute of Remote Sensing, Anna University", observedOn: "2026-01-10" },
    });
    expect(floodBriefIsEmpty(b)).toBe(false);

    const elevation = b.facts.find((f) => f.key === "elevation");
    expect(elevation?.evidence).toBe("ESTIMATE");
    expect(elevation?.value).toBe("9 m");

    const water = b.facts.find((f) => f.key === "mapped_water");
    expect(water?.evidence).toBe("ESTIMATE");
    expect(water?.value).toContain("14");
    expect(water?.value).toContain("0.4 km");

    const zone = b.facts.find((f) => f.key === "official_zone");
    expect(zone?.evidence).toBe("OFFICIAL_SOURCE");
    expect(zone?.value).toContain("Institute of Remote Sensing");
    expect(zone?.value).toContain("2026-01-10");

    const history = b.facts.find((f) => f.key === "waterlogging_history");
    expect(history?.evidence).toBe("UNKNOWN");
    expect(history?.value).toBeNull();
  });

  it("never produces a score, probability, return period or safety verdict", () => {
    const b = floodBrief({
      elevation_m: 3,
      mappedWaterCount: 22,
      nearestWaterKm: 0.1,
      officialZone: { label: "Zone II — flood prone", source: "CMDA", observedOn: "2025-12-01" },
    });
    expect(b.headline).toMatch(/not a flood-risk verdict/);
    for (const f of b.facts) {
      expect(String(f.value)).not.toMatch(/risk score|probability|return period|\d+%|per cent|is safe|is unsafe/i);
    }
    expect(b.caveats.some((c) => /no probability/i.test(c))).toBe(true);
  });

  it("low elevation reads as context and advice, never as a verdict", () => {
    const b = floodBrief({ ...base, elevation_m: 5 });
    const elevation = b.facts.find((f) => f.key === "elevation");
    expect(elevation?.note).toMatch(/Low-lying/);
    expect(elevation?.note).toMatch(/Ask about past waterlogging/);
  });

  it("keeps water unknown when no snapshot exists, even with other data held", () => {
    const b = floodBrief({ ...base, elevation_m: 18 });
    const water = b.facts.find((f) => f.key === "mapped_water");
    expect(water?.evidence).toBe("UNKNOWN");
    expect(water?.value).toBeNull();
  });
});
