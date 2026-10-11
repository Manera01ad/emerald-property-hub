import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CATEGORY_QUERY: Record<string, string> = {
  cbse_school: "CBSE school",
  hospital: "hospital",
  transport: "railway station OR metro station OR bus terminus",
  employment: "IT park OR industrial estate",
};

function km(a: number, b: number, c: number, d: number) {
  const r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)) * 10) / 10;
}

/** Admin-only: search Google Places near a property. Results are suggestions; the admin chooses what to save. */
export const findNearbyPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), category: z.enum(["cbse_school", "hospital", "transport", "employment"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Admins only");
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) throw new Error("Google Maps is not connected");
    const res = await fetch("https://connector-gateway.lovable.dev/google_maps/places/v1/places:searchText", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
        "Content-Type": "application/json",
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location",
      },
      body: JSON.stringify({
        textQuery: CATEGORY_QUERY[data.category],
        pageSize: 10,
        locationBias: { circle: { center: { latitude: data.lat, longitude: data.lng }, radius: 10000 } },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Places failed [${res.status}]: ${body}`);
      throw new Error(`Google Places request failed (${res.status})`);
    }
    const json = (await res.json()) as { places?: { id: string; displayName?: { text: string }; formattedAddress?: string; location?: { latitude: number; longitude: number } }[] };
    return (json.places ?? [])
      .filter((p) => p.location)
      .map((p) => ({
        id: p.id,
        name: p.displayName?.text ?? "Unnamed",
        address: p.formattedAddress ?? "",
        distance_km: km(data.lat, data.lng, p.location!.latitude, p.location!.longitude),
      }))
      .sort((a, b) => a.distance_km - b.distance_km);
  });
