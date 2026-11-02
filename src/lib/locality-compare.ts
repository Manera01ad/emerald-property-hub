/**
 * Side-by-side comparison of localities on flood facts, transport and asking
 * prices. Every cell carries its evidence label; a locality without published
 * data reads Unknown on every row rather than zero. Pure functions only.
 */

import type { AreaSummary, Feature } from "./area-intel";
import type { DealProperty } from "./deal";
import type { Evidence } from "./evidence";
import { floodBrief, floodInputFromSummary } from "./flood";
import { priceContext } from "./price-context";
import { formatINR } from "./format";

export type CompareColumn = { name: string; summary: AreaSummary | null; listings: DealProperty[] };
export type CompareCell = { value: string; evidence: Evidence; note?: string };
export type CompareGroup = "Flood and drainage" | "Transport" | "Asking prices";
export type CompareRow = { key: string; group: CompareGroup; label: string; cells: CompareCell[] };

export const COMPARE_GROUPS: CompareGroup[] = ["Flood and drainage", "Transport", "Asking prices"];

const UNKNOWN: CompareCell = { value: "Unknown", evidence: "UNKNOWN", note: "No published area snapshot." };
const nearest = (f: Feature | null, none: string) => (f ? `${f.name} · ${f.km} km` : none);

function transport(s: AreaSummary | null): Record<string, CompareCell> {
  if (!s) return { bus: UNKNOWN, rail: UNKNOWN, metro: UNKNOWN };
  const t = s.transport;
  const bus = t.nearest_bus_km != null ? `${t.bus_stops} within 1 km · nearest ${t.nearest_bus_km} km` : `${t.bus_stops} within 1 km`;
  return {
    bus: { value: bus, evidence: "ESTIMATE" },
    rail: { value: nearest(t.rail.nearest, "None mapped within 3 km"), evidence: "ESTIMATE" },
    metro: { value: nearest(t.metro.nearest, "None mapped within 3 km"), evidence: "ESTIMATE" },
  };
}

function price(listings: DealProperty[]): CompareCell {
  const p = priceContext(listings, "buy");
  if (p.medianPpsf == null) return { value: "No figure", evidence: "UNKNOWN", note: p.reason };
  return { value: `${formatINR(p.medianPpsf)}/sq ft median · ${formatINR(p.rangePpsf?.low)}–${formatINR(p.rangePpsf?.high)}`, evidence: p.evidence, note: p.reason };
}

export function compareLocalities(cols: CompareColumn[]): CompareRow[] {
  const briefs = cols.map((c) => floodBrief(floodInputFromSummary(c.summary)));
  const rows: CompareRow[] = [];
  for (const fact of briefs[0]?.facts ?? []) {
    rows.push({
      key: `flood-${fact.key}`,
      group: "Flood and drainage",
      label: fact.label,
      cells: briefs.map((b) => {
        const f = b.facts.find((x) => x.key === fact.key)!;
        return { value: f.value ?? "Unknown", evidence: f.evidence, note: f.note };
      }),
    });
  }
  const t = cols.map((c) => transport(c.summary));
  rows.push(
    { key: "transport-bus", group: "Transport", label: "Bus stops", cells: t.map((x) => x["bus"]!) },
    { key: "transport-rail", group: "Transport", label: "Nearest rail station", cells: t.map((x) => x["rail"]!) },
    { key: "transport-metro", group: "Transport", label: "Nearest metro station", cells: t.map((x) => x["metro"]!) },
    { key: "price-sale", group: "Asking prices", label: "Sale asking price per sq ft", cells: cols.map((c) => price(c.listings)) },
  );
  return rows;
}
