/** Neighbourhood layers and livability scoring for the Explore map. Pure functions, no I/O. */

export type LayerKey = "school" | "hospital" | "food" | "grocery" | "transit";

export const LAYERS: Record<LayerKey, { label: string; color: string; weight: number; nearKm: number; farKm: number }> = {
  school: { label: "Schools", color: "#2563eb", weight: 0.25, nearKm: 0.5, farKm: 3 },
  hospital: { label: "Hospitals & clinics", color: "#dc2626", weight: 0.2, nearKm: 1, farKm: 5 },
  grocery: { label: "Supermarkets", color: "#16a34a", weight: 0.2, nearKm: 0.5, farKm: 3 },
  transit: { label: "Bus & rail", color: "#9333ea", weight: 0.2, nearKm: 0.5, farKm: 3 },
  food: { label: "Restaurants & cafes", color: "#ea580c", weight: 0.15, nearKm: 0.5, farKm: 3 },
};
export const LAYER_KEYS = Object.keys(LAYERS) as LayerKey[];

export type Poi = { id: string; layer: LayerKey; name: string; lat: number; lng: number };
export type PoiWithDistance = Poi & { km: number };

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Map an OpenStreetMap element's tags to one of our layers (or null to ignore it). */
export function layerForTags(tags: Record<string, string> | undefined): LayerKey | null {
  if (!tags) return null;
  const amenity = tags["amenity"];
  if (amenity === "school") return "school";
  if (amenity === "hospital" || amenity === "clinic") return "hospital";
  if (amenity === "restaurant" || amenity === "cafe") return "food";
  if (tags["shop"] === "supermarket") return "grocery";
  if (tags["railway"] === "station" || tags["highway"] === "bus_stop" || amenity === "bus_station") return "transit";
  return null;
}

type OverpassElement = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

export function parseOverpass(elements: OverpassElement[], fromLat: number, fromLng: number): PoiWithDistance[] {
  const out: PoiWithDistance[] = [];
  for (const e of elements) {
    const layer = layerForTags(e.tags);
    const lat = e.lat ?? e.center?.lat;
    const lng = e.lon ?? e.center?.lon;
    if (!layer || lat == null || lng == null) continue;
    out.push({ id: `${e.type}/${e.id}`, layer, name: e.tags?.["name"] ?? LAYERS[layer].label.replace(/s$/, ""), lat, lng, km: distanceKm(fromLat, fromLng, lat, lng) });
  }
  return out.sort((a, b) => a.km - b.km);
}

export function overpassQuery(lat: number, lng: number, radiusM: number): string {
  const a = `(around:${Math.round(radiusM)},${lat},${lng})`;
  return `[out:json][timeout:20];(nwr${a}[amenity~"^(school|hospital|clinic|restaurant|cafe|bus_station)$"];nwr${a}[shop=supermarket];nwr${a}[railway=station];nwr${a}[highway=bus_stop];);out center 400;`;
}

/** 0–1 for one layer: full marks within nearKm, fading to zero at farKm. */
export function layerScore(nearestKm: number | undefined, layer: LayerKey): number {
  if (nearestKm == null) return 0;
  const { nearKm, farKm } = LAYERS[layer];
  if (nearestKm <= nearKm) return 1;
  if (nearestKm >= farKm) return 0;
  return 1 - (nearestKm - nearKm) / (farKm - nearKm);
}

export type Livability = { score: number; nearest: Partial<Record<LayerKey, PoiWithDistance>>; counts: Record<LayerKey, number> };

/** Livability 0–100 from nearby places. Only as good as the map data, so show it as an estimate. */
export function livability(pois: PoiWithDistance[]): Livability {
  const nearest: Partial<Record<LayerKey, PoiWithDistance>> = {};
  const counts = { school: 0, hospital: 0, food: 0, grocery: 0, transit: 0 } as Record<LayerKey, number>;
  for (const p of pois) {
    counts[p.layer] += 1;
    const cur = nearest[p.layer];
    if (!cur || p.km < cur.km) nearest[p.layer] = p;
  }
  let score = 0;
  for (const k of LAYER_KEYS) score += LAYERS[k].weight * layerScore(nearest[k]?.km, k);
  return { score: Math.round(score * 100), nearest, counts };
}

export function walkMinutes(km: number): number {
  return Math.max(1, Math.round((km / 4.8) * 60));
}
