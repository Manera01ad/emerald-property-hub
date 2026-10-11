import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

function keys() {
  const a = process.env["LOVABLE_API_KEY"], b = process.env["GOOGLE_MAPS_API_KEY"];
  if (!a || !b) throw new Error("Google Maps is not connected");
  return { Authorization: `Bearer ${a}`, "X-Connection-Api-Key": b };
}

async function fail(res: Response, what: string): Promise<never> {
  const body = await res.text();
  console.error(`${what} failed [${res.status}]: ${body}`);
  if (res.status === 403) throw new Error(`${what}: Google denied the request — this API may not be enabled for the key.`);
  if (res.status === 429) throw new Error(`${what}: daily Google Maps limit reached. Try again later.`);
  throw new Error(`${what} failed (${res.status})`);
}

/** Signed-in users only (keeps Google usage bounded). Geocode an address in Tamil Nadu. */
export const geocodeAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ address: z.string().trim().min(3).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const res = await fetch(`${GATEWAY}/maps/api/geocode/json?region=in&components=country:IN&address=${encodeURIComponent(data.address)}`, { headers: keys() });
    if (!res.ok) await fail(res, "Address search");
    const j = (await res.json()) as { status: string; results?: { formatted_address: string; geometry: { location: { lat: number; lng: number }; location_type: string } }[] };
    if (j.status === "ZERO_RESULTS") return [];
    if (j.status !== "OK") throw new Error(`Address search: Google returned ${j.status}`);
    return (j.results ?? []).slice(0, 5).map((r) => ({
      address: r.formatted_address, lat: r.geometry.location.lat, lng: r.geometry.location.lng,
      approximate: r.geometry.location_type !== "ROOFTOP",
    }));
  });

/** Signed-in users only. One driving route between two points (Routes API). */
export const travelRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const pt = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
    return z.object({ from: pt, to: pt, mode: z.enum(["DRIVE", "TWO_WHEELER", "WALK"]) }).parse(d);
  })
  .handler(async ({ data }) => {
    const wp = (p: { lat: number; lng: number }) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
    const res = await fetch(`${GATEWAY}/routes/directions/v2:computeRoutes`, {
      method: "POST",
      headers: { ...keys(), "Content-Type": "application/json", "X-Goog-FieldMask": "routes.distanceMeters,routes.duration" },
      body: JSON.stringify({ origin: wp(data.from), destination: wp(data.to), travelMode: data.mode, ...(data.mode === "WALK" ? {} : { routingPreference: "TRAFFIC_UNAWARE" }) }),
    });
    if (!res.ok) await fail(res, "Travel route");
    const j = (await res.json()) as { routes?: { distanceMeters?: number; duration?: string }[] };
    const r = j.routes?.[0];
    if (!r?.duration) return null;
    return { km: Math.round((r.distanceMeters ?? 0) / 100) / 10, minutes: Math.round(parseFloat(r.duration) / 60) };
  });
