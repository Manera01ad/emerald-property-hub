/** Pure helpers for the map page. No network access. */
export type LatLng = { lat: number; lng: number };

export function validLatLng(lat: unknown, lng: unknown): LatLng | null {
  const a = Number(lat), b = Number(lng);
  if (lat === null || lng === null || lat === "" || lng === "" || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a < -90 || a > 90 || b < -180 || b > 180) return null;
  if (a === 0 && b === 0) return null;
  return { lat: a, lng: b };
}

const PAIR = /(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/;

/** Extract coordinates locally from map URLs or "lat,lng"; never contacts a map provider. */
export function parseLocationInput(raw: string): { ok: true; point: LatLng } | { ok: false; error: string } {
  const s = raw.trim();
  if (!s) return { ok: false, error: "Enter a map link or coordinates." };
  if (!/^https?:\/\//i.test(s)) {
    const m = s.match(new RegExp(`^${PAIR.source}$`));
    const p = m && validLatLng(m[1], m[2]);
    return p ? { ok: true, point: p } : { ok: false, error: "Coordinates must look like 13.0827, 80.2707." };
  }
  let u: URL;
  try { u = new URL(s); } catch { return { ok: false, error: "That link isn't a valid web address." }; }
  const host = u.hostname.toLowerCase();
  if (host === "openstreetmap.org" || host === "www.openstreetmap.org") {
    const pin = validLatLng(u.searchParams.get("mlat"), u.searchParams.get("mlon"));
    if (pin) return { ok: true, point: pin };
    const camera = u.hash.match(/^#map=\d+\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/);
    const point = camera && validLatLng(camera[1], camera[2]);
    return point ? { ok: true, point } : { ok: false, error: "This map link has no coordinates. Paste latitude and longitude instead." };
  }
  if (host === "maps.app.goo.gl" || host === "goo.gl")
    return { ok: false, error: "Short share links aren't supported. Open the link, then copy the full address from your browser, or paste the coordinates." };
  if (!/(^|\.)google\.[a-z.]+$/.test(host) || !(host.startsWith("maps.") || u.pathname.startsWith("/maps")))
    return { ok: false, error: "Use an OpenStreetMap link, a full map share link with coordinates, or latitude and longitude." };
  const d = s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (d) { const p = validLatLng(d[1], d[2]); if (p) return { ok: true, point: p }; }
  const at = u.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) { const p = validLatLng(at[1], at[2]); if (p) return { ok: true, point: p }; }
  for (const k of ["q", "query", "ll", "center", "destination"]) {
    const v = u.searchParams.get(k);
    const m = v?.match(PAIR);
    const p = m && validLatLng(m[1], m[2]);
    if (p) return { ok: true, point: p };
  }
  return { ok: false, error: "This map link has no coordinates in it. Paste the coordinates or search the address instead." };
}
