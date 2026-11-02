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
  officialZone?: { label: string; source: string; observedOn: string; url?: string | null } | null;
};

/**
 * An official flood-zone record an admin filed for an area, kept inside the
 * area-intelligence summary under `official_flood`. The label is the source's
 * own wording, carried verbatim — never a score derived from it.
 */
export type OfficialFloodRecord = {
  label: string;
  source: string;
  source_url: string | null;
  /** The date the source describes or was published, YYYY-MM-DD. */
  observed_on: string;
  /** When the admin filed it (ISO timestamp). */
  recorded_at: string;
};

export type OfficialFloodDraft = { label: string; source: string; source_url: string; observed_on: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * Checks an admin's entry before it is saved. A record needs the source's own
 * label, a named source and a real date that is not in the future; a link, if
 * given, must be https.
 */
export function validateOfficialFlood(
  draft: OfficialFloodDraft,
  today: string = new Date().toISOString().slice(0, 10),
  now: string = new Date().toISOString(),
): { ok: true; record: OfficialFloodRecord } | { ok: false; errors: string[] } {
  const label = draft.label.trim();
  const source = draft.source.trim();
  const url = draft.source_url.trim();
  const observed = draft.observed_on.trim();
  const errors: string[] = [];
  if (label.length < 3 || label.length > 160) errors.push("Enter the record's label as the source words it (3–160 characters).");
  if (source.length < 3 || source.length > 160) errors.push("Name the official source (3–160 characters).");
  if (!isRealDate(observed)) errors.push("Enter the source's date as YYYY-MM-DD.");
  else if (observed > today) errors.push("The source's date cannot be in the future.");
  if (url) {
    let valid = false;
    try { valid = new URL(url).protocol === "https:"; } catch { valid = false; }
    if (!valid) errors.push("The source link must start with https://.");
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, record: { label, source, source_url: url || null, observed_on: observed, recorded_at: now } };
}

/** Reads a stored record back, tolerating missing or malformed data (which reads as no record). */
export function readOfficialFlood(summary: unknown): OfficialFloodRecord | null {
  if (!summary || typeof summary !== "object") return null;
  const r = (summary as Record<string, unknown>)["official_flood"];
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : null);
  const label = str("label"), source = str("source"), observed = str("observed_on");
  if (!label || !source || !observed || !isRealDate(observed)) return null;
  const url = str("source_url");
  return { label, source, source_url: url && url.startsWith("https://") ? url : null, observed_on: observed, recorded_at: str("recorded_at") ?? "" };
}

/**
 * Keeps an admin-filed official record when the open-data snapshot is refreshed,
 * so re-fetching map data never silently deletes official evidence.
 */
export function withOfficialFlood<T extends object>(fresh: T, previous: unknown): T & { official_flood?: OfficialFloodRecord } {
  const kept = readOfficialFlood(previous);
  return kept ? { ...fresh, official_flood: kept } : fresh;
}

export type FloodFact = {
  key: string;
  label: string;
  /** What can be stated, or null when we hold nothing at all. */
  value: string | null;
  evidence: Evidence;
  note: string;
  /** Link to the source, only for an official record that has one. */
  url?: string;
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
      ? { key: "official_zone", label: "Official flood-zone record", value: `${input.officialZone.label} — source: ${input.officialZone.source}, dated ${input.officialZone.observedOn}`, evidence: "OFFICIAL_SOURCE", note: "Recorded from the named official publication. It describes the area, not any specific plot.", ...(input.officialZone.url ? { url: input.officialZone.url } : {}) }
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
 * summary (no published snapshot) gives all-unknown input. The official zone is
 * read only from an admin-filed `official_flood` record; it is never inferred.
 */
export function floodInputFromSummary(summary: AreaSummary | null | undefined): FloodInput {
  if (!summary) return { elevation_m: null, mappedWaterCount: null, nearestWaterKm: null, officialZone: null };
  const elevation = typeof summary.elevation_m === "number" && Number.isFinite(summary.elevation_m) ? summary.elevation_m : null;
  const water = summary.water;
  const official = readOfficialFlood(summary);
  return {
    elevation_m: elevation,
    mappedWaterCount: water && typeof water.count === "number" ? water.count : null,
    nearestWaterKm: water?.nearest && typeof water.nearest.km === "number" ? water.nearest.km : null,
    officialZone: official ? { label: official.label, source: official.source, observedOn: official.observed_on, url: official.source_url } : null,
  };
}

/** True when every fact is unknown — the honest "we hold nothing" state. */
export function floodBriefIsEmpty(brief: FloodBrief): boolean {
  return brief.facts.every((f) => f.evidence === "UNKNOWN");
}
