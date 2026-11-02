import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { floodBrief, floodInputFromSummary, readOfficialFlood, validateOfficialFlood, withOfficialFlood } from "./flood";
import { summariseArea } from "./area-intel";
import { FloodPanel } from "@/components/FloodPanel";

const TODAY = "2026-11-02";
const NOW = "2026-11-02T10:00:00.000Z";
const good = { label: "Inundated in the Dec 2015 flood map", source: "Greater Chennai Corporation", source_url: "https://chennaicorporation.gov.in/flood", observed_on: "2016-03-01" };

describe("official flood record validation", () => {
  it("accepts a complete record and trims it", () => {
    const r = validateOfficialFlood({ ...good, label: `  ${good.label}  ` }, TODAY, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.record.label).toBe(good.label);
      expect(r.record.recorded_at).toBe(NOW);
    }
  });

  it("allows a record with no link", () => {
    const r = validateOfficialFlood({ ...good, source_url: "" }, TODAY, NOW);
    expect(r.ok && r.record.source_url).toBeNull();
  });

  it("rejects a missing label or source, a bad or future date and a non-https link", () => {
    const r = validateOfficialFlood({ label: "x", source: "", source_url: "http://insecure.example", observed_on: "2027-01-01" }, TODAY, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(4);
    const bad = validateOfficialFlood({ ...good, observed_on: "2026-02-30" }, TODAY, NOW);
    expect(bad.ok).toBe(false);
  });
});

describe("official flood record storage", () => {
  const summary = summariseArea([], 12.845, 80.06, 9);
  const record = { ...good, recorded_at: NOW };

  it("reads a stored record and ignores malformed ones", () => {
    expect(readOfficialFlood({ ...summary, official_flood: record })?.source).toBe(good.source);
    expect(readOfficialFlood({ ...summary, official_flood: { label: "only a label" } })).toBeNull();
    expect(readOfficialFlood({ ...summary, official_flood: { ...record, source_url: "javascript:alert(1)" } })?.source_url).toBeNull();
    expect(readOfficialFlood(null)).toBeNull();
  });

  it("keeps the official record when the open-data snapshot is refreshed", () => {
    const fresh = summariseArea([], 12.845, 80.06, 10);
    const merged = withOfficialFlood(fresh, { ...summary, official_flood: record });
    expect(merged.elevation_m).toBe(10);
    expect(merged.official_flood?.label).toBe(good.label);
    expect(withOfficialFlood(fresh, summary)).not.toHaveProperty("official_flood");
  });

  it("shows a filed record with an Official source badge and a link", () => {
    const brief = floodBrief(floodInputFromSummary({ ...summary, official_flood: record } as typeof summary));
    const zone = brief.facts.find((f) => f.key === "official_zone");
    expect(zone?.evidence).toBe("OFFICIAL_SOURCE");
    expect(zone?.url).toBe(good.source_url);
    render(<FloodPanel brief={brief} area="Tambaram" />);
    expect(screen.getByTestId("flood-fact-official_zone")).toHaveTextContent("Official source");
    expect(screen.getByTestId("flood-fact-official_zone")).toHaveTextContent("Greater Chennai Corporation");
    expect(screen.getByTestId("flood-fact-official_zone-source-link")).toHaveAttribute("href", good.source_url);
  });
});
