import { validLatLng } from "./mapurl";

/** Small, explicit user searches; no autocomplete, polling or bulk geocoding. */
export async function searchLocation(address: string) {
  const query = new URLSearchParams({ q: address.trim(), lat: "13.0827", lon: "80.2707", limit: "5", lang: "en" });
  const response = await fetch(`https://photon.komoot.io/api/?${query}`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Address search is temporarily unavailable (${response.status}). Paste coordinates instead.`);
  const data = await response.json();
  if (!Array.isArray(data.features)) throw new Error("Address search returned an incomplete response.");
  return data.features.flatMap((feature: { geometry?: { coordinates?: unknown[] }; properties?: Record<string, unknown> }) => {
    const point = validLatLng(feature.geometry?.coordinates?.[1], feature.geometry?.coordinates?.[0]);
    if (!point) return [];
    const p = feature.properties ?? {};
    const label = [...new Set([p["name"], p["street"], p["city"], p["state"], p["country"]].filter((v) => typeof v === "string" && v))].join(", ");
    return [{ ...point, address: label || address, approximate: true }];
  });
}