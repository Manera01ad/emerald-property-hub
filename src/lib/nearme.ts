import { AREAS } from "./areas";
import { distanceKm } from "./livability";
import type { LatLng } from "./mapurl";

/** "What is for sale near me": merges your own listings (exact location) with private observations from authorised sources (area-level location). */

export type NearListing = {
  id: string; title: string; property_type: string; location: string; address: string | null; asking_price: number;
  bedrooms: number | null; built_area_sqft: number | null; land_area_sqft: number | null; status: string;
  latitude: number | null; longitude: number | null;
};
export type NearObservation = {
  id: string; title: string | null; property_type: string | null; location: string | null; address: string | null; asking_price: number | null;
  bedrooms: number | null; built_area_sqft: number | null; land_area_sqft: number | null; source_url: string | null; seller_name: string | null;
  quality_flags: string[]; property_id: string | null; duplicate_of_property: string | null; duplicate_of_observation: string | null; missing_since: string | null;
};

export type NearItem = {
  key: string; kind: "listing" | "observed"; title: string; property_type: string | null; area: string; price: number | null; bedrooms: number | null;
  sqft: number | null; km: number; exact: boolean; status: string; link: string | null; flags: string[];
};
export type NearFilters = { origin: LatLng; radiusKm: number; type?: string | undefined; maxPrice?: number | undefined; minBedrooms?: number | undefined };
export type NearResult = { items: NearItem[]; unmatchedObservations: number; hiddenObservations: number };

export function areaCentre(location: string | null | undefined): { name: string; point: LatLng } | null {
  const s = (location ?? "").trim().toLowerCase();
  if (!s) return null;
  for (const [name, point] of Object.entries(AREAS["Chennai"]!)) if (name.toLowerCase() === s) return { name, point };
  return null;
}

/** Distance from a point to a listing: exact if it has coordinates, otherwise to the middle of its area, otherwise unknown. */
export function listingDistance(p: { latitude: number | null; longitude: number | null; location: string | null }, origin: LatLng): { km: number; exact: boolean } | null {
  if (p.latitude != null && p.longitude != null) return { km: distanceKm(origin.lat, origin.lng, p.latitude, p.longitude), exact: true };
  const c = areaCentre(p.location);
  return c ? { km: distanceKm(origin.lat, origin.lng, c.point.lat, c.point.lng), exact: false } : null;
}

const sqftOf = (type: string | null, built: number | null, land: number | null) => (type === "plot" ? land : built ?? land);

export function nearMe(listings: NearListing[], observations: NearObservation[], f: NearFilters): NearResult {
  const items: NearItem[] = [];
  let unmatched = 0, hidden = 0;
  const pass = (type: string | null, price: number | null, beds: number | null) =>
    (!f.type || type === f.type) && (f.maxPrice == null || (price != null && price <= f.maxPrice)) && (f.minBedrooms == null || (beds != null && beds >= f.minBedrooms));

  for (const p of listings) {
    if (p.status === "archived") continue;
    let km: number, exact = false;
    if (p.latitude != null && p.longitude != null) { km = distanceKm(f.origin.lat, f.origin.lng, p.latitude, p.longitude); exact = true; }
    else {
      const c = areaCentre(p.location);
      if (!c) continue;
      km = distanceKm(f.origin.lat, f.origin.lng, c.point.lat, c.point.lng);
    }
    if (km > f.radiusKm || !pass(p.property_type, Number(p.asking_price), p.bedrooms)) continue;
    items.push({ key: `p:${p.id}`, kind: "listing", title: p.title, property_type: p.property_type, area: p.location, price: Number(p.asking_price), bedrooms: p.bedrooms,
      sqft: sqftOf(p.property_type, p.built_area_sqft, p.land_area_sqft), km, exact, status: p.status, link: null, flags: [] });
  }

  for (const o of observations) {
    // Already a listing, a duplicate of one, or no longer offered by the source.
    if (o.property_id || o.duplicate_of_property || o.duplicate_of_observation || o.missing_since) { hidden++; continue; }
    const c = areaCentre(o.location);
    if (!c) { unmatched++; continue; }
    const km = distanceKm(f.origin.lat, f.origin.lng, c.point.lat, c.point.lng);
    if (km > f.radiusKm || !pass(o.property_type, o.asking_price == null ? null : Number(o.asking_price), o.bedrooms)) continue;
    items.push({ key: `o:${o.id}`, kind: "observed", title: o.title ?? "Untitled", property_type: o.property_type, area: c.name, price: o.asking_price == null ? null : Number(o.asking_price),
      bedrooms: o.bedrooms, sqft: sqftOf(o.property_type, o.built_area_sqft, o.land_area_sqft), km, exact: false, status: "observed", link: o.source_url, flags: o.quality_flags ?? [] });
  }
  items.sort((a, b) => a.km - b.km);
  return { items, unmatchedObservations: unmatched, hiddenObservations: hidden };
}
