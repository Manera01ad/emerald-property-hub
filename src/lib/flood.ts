/**
 * Flood and drainage context for an area — what we can honestly state, and what
 * a buyer must check on the ground.
 *
 * This module deliberately produces no flood-risk score, zone class, probability
 * or return period. The site holds no flood map and no waterlogging record (the
 * flood-water-risk assistant skill says the same), so the honest output is: a few
 * facts from data we actually hold, each carrying its evidence label, an explicit
 * list of what we do not know, and the checks a buyer should run themselves.
 * Anything without evidence is UNKNOWN, never a guess.
 *
 * Pure functions only. No I/O, no fetching, no database access.
 */

import type { Evidence } from "./evidence";
import { elevationNote, type AreaSummary } from "./area-intel";

/** Everything the brief needs — all of it already collected by area intelligence. */
export type FloodInput = {
  /** Height above sea level in metres (Open-Meteo estimate), or null when unknown. */
  elevation_m: number | null;
  /** Mapped lakes, tanks, canals and drains within 2 km (OpenStreetMap), or null when no snapshot exists. */
  mappedWaterCount: number | null;
  /** Straight-line distance to the nearest mapped water feature, in km, or null. */
  nearestWaterKm: number | null;
  /**
   * An official flood-zone record for this area, when one has been verified and
   * its source filed. The label is whatever the source calls it — carried
   * verbatim, with the source and date — never a score invented from it.
   */
  officialZone?: { label: string; source: string; observedOn: string } | null;
};

export type FloodFact = {
  key: string;
  label: string;
  /** What can be stated, or null when we hold nothing at all. */
  value: string | null;
  evidence: Evidence;
  note: string;
};

export type FloodBrief = {
  headline: string;
  facts: FloodFact[];
  /** What we do not hold, stated so absence is never read as all-clear. */
  unknowns: string[];
  /** Checks only a person on the ground can run. */
  groundChecks: string[];
  caveats: string[];
};

export const FLOOD_HEADLINE =
  "We hold no flood map for this area, so this is context and a checklist — not a flood-risk verdict.";

/**
 * Builds the flood and drainage brief for one area. Every fact is labelled with
 * the evidence standing behind it; missing data is listed as unknown.
 */
export function floodBrief(input: FloodInput): FloodBrief {
  const facts: FloodFact[] = [];

  facts.push(
    input.elevation_m == null
      ? { key: "elevation", label: "Height above sea level", value: null, evidence: "UNKNOWN", note: "No elevation estimate on record for this area." }
      : { key: "elevation", label: "Height above sea level", value: `${Math.round(input.elevation_m)} m`, evidence: "ESTIMATE", note: elevationNote(input.elevation_m) },
  );

  if (input.mappedWaterCount == null) {
    facts.push({ key: "mapped_water", label: "Mapped water within 2 km", value: null, evidence: "UNKNOWN", note: "No open-map snapshot on record, so nothing is shown." });
  } else {
    const nearest = input.nearestWaterKm != null ? `, nearest about ${input.nearestWaterKm} km away` : "";
    facts.push({ key: "mapped_water", label: "Mapped water within 2 km", value: `${input.mappedWaterCount} lakes, tanks, canals or drains${nearest}`, evidence: "ESTIMATE", note: "OpenStreetMap is community-mapped and may be incomplete. Nearby water is context, not a flood assessment." });
  }

  facts.push(
    input.officialZone
      ? { key: "official_zone", label: "Official flood-zone record", value: `${input.officialZone.label} — source: ${input.officialZone.source}, dated ${input.officialZone.observedOn}`, evidence: "OFFICIAL_SOURCE", note: "Recorded from the named official publication. It describes the area, not any specific plot." }
      : { key: "official_zone", label: "Official flood-zone record", value: null, evidence: "UNKNOWN", note: "No official flood map on file for this area." },
  );

  facts.push({ key: "waterlogging_history", label: "Waterlogging history", value: null, evidence: "UNKNOWN", note: "No record of past monsoon waterlogging on file for this area." });

  const unknowns: string[] = [];
  if (!input.officialZone) unknowns.push("Whether an official flood map covers this area");
  unknowns.push(
    "Waterlogging history in past monsoons",
    "Storm-water drain capacity and coverage",
    "Site levels relative to the road",
  );

  const groundChecks = [
    "Ask residents how the street drained in the last heavy monsoon.",
    "Compare the plot's level and plinth height with the road in front.",
    "Find the nearest storm-water drain and ask whether it overflows.",
    "Visit during or just after heavy rain if you can.",
    "Ask for any flood or waterlogging history in writing before committing.",
  ];

  const caveats = [
    "This brief is not a flood assessment, an insurance decision or a legal opinion.",
    "Water and elevation figures come from open data around the area's approximate centre, not a specific plot.",
    "No probability, return period or risk score is calculated anywhere on this site.",
  ];

  return { headline: FLOOD_HEADLINE, facts, unknowns, groundChecks, caveats };
}

/**
 * Reads the flood inputs out of a published area-intelligence summary. A missing
 * summary (no published snapshot) gives all-unknown input. No official zone is
 * read from it: the summary holds no such field, and none is invented.
 */
export function floodInputFromSummary(summary: AreaSummary | null | undefined): FloodInput {
  if (!summary) return { elevation_m: null, mappedWaterCount: null, nearestWaterKm: null, officialZone: null };
  const elevation = typeof summary.elevation_m === "number" && Number.isFinite(summary.elevation_m) ? summary.elevation_m : null;
  const water = summary.water;
  return {
    elevation_m: elevation,
    mappedWaterCount: water && typeof water.count === "number" ? water.count : null,
    nearestWaterKm: water?.nearest && typeof water.nearest.km === "number" ? water.nearest.km : null,
    officialZone: null,
  };
}

/** True when every fact is unknown — the honest "we hold nothing" state. */
export function floodBriefIsEmpty(brief: FloodBrief): boolean {
  return brief.facts.every((f) => f.evidence === "UNKNOWN");
}
