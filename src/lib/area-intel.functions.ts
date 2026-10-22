import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { AREAS } from "@/lib/areas";
import { overpassAreaQuery, summariseArea, type OsmElement } from "@/lib/area-intel";

const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const UA = "PropWise/1.0";

/** Public Overpass servers are often busy; try each mirror once. */
async function fetchOsm(query: string): Promise<OsmElement[]> {
  let last = "";
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "User-Agent": UA, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: query }),
      });
      if (res.ok && (res.headers.get("content-type") ?? "").includes("json")) {
        return ((await res.json()) as { elements?: OsmElement[] }).elements ?? [];
      }
      last = String(res.status);
    } catch (e) {
      last = (e as Error).message;
    }
  }
  console.error("area intelligence: all map servers failed", last);
  throw new Error("The open map servers are busy right now. Try again in a few minutes.");
}

/** Admin-only: fetch fresh open data for one area and save it as a hidden draft. */
export const refreshAreaIntelligence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ city: z.string().min(1).max(60), area: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Admins only");
    const pt = AREAS[data.city]?.[data.area];
    if (!pt) throw new Error("Unknown area");

    const elements = await fetchOsm(overpassAreaQuery(pt.lat, pt.lng));

    let elevation: number | null = null;
    const el = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${pt.lat}&longitude=${pt.lng}`, { headers: { "User-Agent": UA } });
    if (el.ok) {
      const v = ((await el.json()) as { elevation?: number[] }).elevation?.[0];
      if (typeof v === "number" && Number.isFinite(v)) elevation = v;
    }

    const summary = summariseArea(elements, pt.lat, pt.lng, elevation);
    const now = new Date().toISOString();
    const sources = [
      { name: "OpenStreetMap contributors (ODbL)", url: "https://www.openstreetmap.org/copyright", fetched_at: now },
      { name: "Open-Meteo elevation (Copernicus DEM, 90 m)", url: "https://open-meteo.com/en/docs/elevation-api", fetched_at: now },
    ];
    const { error } = await context.supabase.from("area_intelligence").upsert(
      {
        city: data.city, area: data.area, latitude: pt.lat, longitude: pt.lng,
        elevation_m: elevation, summary: summary as unknown as Json, sources: sources as unknown as Json, fetched_at: now,
      },
      { onConflict: "city,area" },
    );
    if (error) throw new Error(`Couldn't save: ${error.message}`);
    return { area: data.area, elements: elements.length, elevation };
  });
