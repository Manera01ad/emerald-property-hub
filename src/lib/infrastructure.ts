import { AREAS } from "./areas";
import { humanize } from "./constants";

/**
 * Buyer-facing words for the stored progress values.
 *
 * The database column keeps its own vocabulary (`announced`, `approved`, ...)
 * because the research engine writes those values. This map only changes how
 * they read on the page, so the schema and the engine stay untouched.
 */
export const INFRA_STATUS_LABELS: Record<string, string> = {
  announced: "Planned",
  approved: "Planned",
  under_construction: "Under construction",
  completed: "Open",
  stalled: "Stalled",
};

export function infraStatusLabel(status: string): string {
  return INFRA_STATUS_LABELS[status] ?? humanize(status);
}

/** Rows with no linked area are collected under this heading, shown last. */
export const OTHER_AREA = "Other areas";

export type AreaGroup<T> = { area: string; projects: T[] };

/**
 * Group projects by linked area: named areas alphabetically, then "Other areas".
 * Rows whose `area` is missing or blank fall into the other bucket rather than
 * disappearing, so nothing is silently hidden.
 */
export function groupByArea<T extends { area: string | null }>(rows: T[]): AreaGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = row.area?.trim() ? row.area : OTHER_AREA;
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }
  return [...map.entries()]
    .map(([area, projects]) => ({ area, projects }))
    .sort((a, b) => {
      if (a.area === OTHER_AREA) return 1;
      if (b.area === OTHER_AREA) return -1;
      return a.area.localeCompare(b.area);
    });
}

/** Area names an admin can pick from, taken from the shared area list. */
export function areaOptions(city = "Chennai"): string[] {
  return Object.keys(AREAS[city] ?? {}).sort((a, b) => a.localeCompare(b));
}

export function isKnownArea(area: string, city = "Chennai"): boolean {
  return Boolean(AREAS[city]?.[area]);
}
