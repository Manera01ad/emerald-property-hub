import { validLatLng, type LatLng } from "@/lib/mapurl";

// Explicit, user-submitted searches only; never autocomplete or bulk queries.
export async function searchOpenMap(address: string, signal: AbortSignal) {
  const query = new URLSearchParams({ q: address.trim(), format: "jsonv2", limit: "3", countrycodes: "in" });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${query}`, { signal });
  if (!response.ok) throw new Error(`Address search is unavailable (${response.status}). Try coordinates instead.`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error("Address search returned an invalid response.");
  return data.flatMap((item) => {
    const point = validLatLng(item?.lat, item?.lon);
    return point && typeof item.display_name === "string" ? [{ point, label: item.display_name }] : [];
  });
}

export async function openMapRoute(from: LatLng, to: LatLng) {
  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false&alternatives=false&steps=false`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Road routing is unavailable (${response.status}). Please try later.`);
  const data = await response.json();
  const route = data.routes?.[0];
  if (data.code === "NoRoute") return null;
  if (data.code !== "Ok" || !route || !Number.isFinite(route.distance) || !Number.isFinite(route.duration)) throw new Error("No reliable road route was returned.");
  return { km: (route.distance / 1000).toFixed(1), minutes: Math.round(route.duration / 60) };
}