/** Pure rules for area intelligence built from OpenStreetMap + Open-Meteo elevation. No I/O here. */

export const WATER_RADIUS_M = 2000;
export const PARK_RADIUS_M = 1500;
export const BUS_RADIUS_M = 1000;
export const RAIL_RADIUS_M = 3000;

export function overpassAreaQuery(lat: number, lng: number): string {
  const a = (r: number) => `(around:${r},${lat},${lng})`;
  return `[out:json][timeout:25];(
nwr["natural"="water"]${a(WATER_RADIUS_M)};
nwr["waterway"~"^(river|canal|drain|stream)$"]${a(WATER_RADIUS_M)};
nwr["leisure"~"^(park|garden|playground)$"]${a(PARK_RADIUS_M)};
node["highway"="bus_stop"]${a(BUS_RADIUS_M)};
nwr["railway"~"^(station|halt)$"]${a(RAIL_RADIUS_M)};
nwr["public_transport"="station"]["station"="subway"]${a(RAIL_RADIUS_M)};
);out tags center 400;`;
}

export interface OsmElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface Feature { name: string; km: number }
export interface Group { count: number; nearest: Feature | null; named: Feature[] }

export interface AreaSummary {
  water: Group & { waterways: number };
  parks: Group;
  transport: { bus_stops: number; nearest_bus_km: number | null; rail: Group; metro: Group };
  elevation_m: number | null;
  elevation_note: string;
  caveats: string[];
}

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function group(items: { name?: string | undefined; km: number }[]): Group {
  const sorted = [...items].sort((a, b) => a.km - b.km);
  const named: Feature[] = [];
  const seen = new Set<string>();
  for (const i of sorted) {
    if (!i.name || seen.has(i.name)) continue;
    seen.add(i.name);
    named.push({ name: i.name, km: round(i.km) });
    if (named.length >= 5) break;
  }
  const first = sorted[0];
  return { count: sorted.length, nearest: first ? { name: first.name ?? "Unnamed", km: round(first.km) } : null, named };
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Elevation note: Chennai is low-lying; this is context, never a flood verdict. */
export function elevationNote(m: number | null): string {
  if (m == null) return "Height above sea level not available.";
  if (m < 10) return "Low-lying (under 10 m above sea level). Ask about past waterlogging and check drainage before buying.";
  if (m < 25) return "Moderate height (10–25 m above sea level). Local drainage still matters more than height alone.";
  return "Relatively higher ground (25 m+ above sea level) for the Chennai region. This does not rule out local waterlogging.";
}

export function summariseArea(elements: OsmElement[], lat: number, lng: number, elevation: number | null): AreaSummary {
  const water: { name?: string | undefined; km: number }[] = [];
  let waterways = 0;
  const parks: typeof water = [], rail: typeof water = [], metro: typeof water = [], bus: number[] = [];
  const seenIds = new Set<string>();
  for (const e of elements) {
    const key = `${e.type}/${e.id}`;
    if (seenIds.has(key)) continue;
    seenIds.add(key);
    const p = e.center ?? (e.lat != null && e.lon != null ? { lat: e.lat, lon: e.lon } : null);
    if (!p) continue;
    const t = e.tags ?? {};
    const item = { name: t["name:en"] ?? t["name"], km: distanceKm(lat, lng, p.lat, p.lon) };
    if (t["natural"] === "water") water.push(item);
    else if (t["waterway"]) { waterways++; water.push(item); }
    else if (t["leisure"]) parks.push(item);
    else if (t["highway"] === "bus_stop") bus.push(item.km);
    else if (t["station"] === "subway") metro.push(item);
    else if (t["railway"]) rail.push(item);
  }
  return {
    water: { ...group(water), waterways },
    parks: group(parks),
    transport: {
      bus_stops: bus.length,
      nearest_bus_km: bus.length ? round(Math.min(...bus)) : null,
      rail: group(rail),
      metro: group(metro),
    },
    elevation_m: elevation,
    elevation_note: elevationNote(elevation),
    caveats: [
      "Counted around the area's approximate centre point, not a specific property.",
      "Distances are straight-line, not road travel distances.",
      "OpenStreetMap is community-mapped and may be incomplete or out of date.",
      "Nearby water bodies are not a flood assessment; ask locally and check official records.",
    ],
  };
}
