/** Pure rules for the controlled locality list. No I/O here, so they stay testable. */

export type LocalityTier = 1 | 2 | 3;
export type LocalityStatus = "hidden" | "active";

export type Locality = {
  id: string;
  slug: string;
  name: string;
  city: string;
  state: string;
  corridor: string;
  tier: number;
  status: LocalityStatus;
  latitude: number | null;
  longitude: number | null;
};

export const LOCALITY_TIERS: LocalityTier[] = [1, 2, 3];

export const TIER_LABELS: Record<LocalityTier, string> = {
  1: "Tier 1 — full evidence first",
  2: "Tier 2 — next in line",
  3: "Tier 3 — planned, not yet studied",
};

export function isLocalityTier(value: number): value is LocalityTier {
  return value === 1 || value === 2 || value === 3;
}

/** Only active localities are shown to buyers; the rest exist so the region can be added later. */
export function visibleLocalities(rows: Locality[]): Locality[] {
  return rows.filter((r) => r.status === "active");
}

/** Tier first, then locality name, so the pilot areas lead every list. */
export function sortLocalities(rows: Locality[]): Locality[] {
  return [...rows].sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
}

export function groupByCorridor(rows: Locality[]): { corridor: string; localities: Locality[] }[] {
  const byCorridor = new Map<string, Locality[]>();
  for (const row of sortLocalities(rows)) {
    const list = byCorridor.get(row.corridor) ?? [];
    list.push(row);
    byCorridor.set(row.corridor, list);
  }
  return [...byCorridor.entries()].map(([corridor, localities]) => ({ corridor, localities }));
}

export function findLocality(rows: Locality[], slug: string): Locality | null {
  return rows.find((r) => r.slug === slug) ?? null;
}
