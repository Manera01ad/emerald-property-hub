import { useEffect, useRef, useState } from "react";
import { LAYERS, LAYER_KEYS, overpassQuery, parseOverpass, type PoiWithDistance } from "@/lib/livability";
import { OSM_STYLE, loadMapLibre } from "@/lib/maplibre";

const OVERPASS = "https://overpass-api.de/api/interpreter";
const RADIUS_M = 2000;

/**
 * Neighbourhood map for a locality. Places come from OpenStreetMap on demand.
 * If the map or the place lookup fails, the caller is told so it can say UNKNOWN
 * instead of showing an empty map that looks like a result.
 */
export function LocalityMap({ name, lat, lng }: { name: string; lat: number; lng: number }) {
  const el = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [pois, setPois] = useState<PoiWithDistance[]>([]);

  useEffect(() => {
    let dead = false;
    let map: any = null;
    const ctl = new AbortController();
    loadMapLibre()
      .then((ml) => {
        if (dead || !el.current) return;
        map = new ml.Map({ container: el.current, center: [lng, lat], zoom: 13, style: OSM_STYLE });
        map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
        new ml.Marker({ color: "#0f172a" }).setLngLat([lng, lat]).addTo(map);
      })
      .catch(() => { if (!dead) setState("error"); });

    fetch(OVERPASS, { method: "POST", body: new URLSearchParams({ data: overpassQuery(lat, lng, RADIUS_M) }), signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json: { elements?: any[] }) => { if (!dead) { setPois(parseOverpass(json.elements ?? [], lat, lng)); setState("ok"); } })
      .catch((e) => { if (!dead && (e as Error).name !== "AbortError") setState("error"); });

    return () => { dead = true; ctl.abort(); map?.remove(); };
  }, [lat, lng]);

  return (
    <div>
      <div ref={el} className="h-80 w-full overflow-hidden rounded-xl border bg-muted" role="img" aria-label={`Map around ${name}`} />
      {state === "error" ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Unknown — the open map place lookup did not answer, so we cannot list what is near {name} right now. Try again later.
        </p>
      ) : state === "loading" ? (
        <p className="mt-3 text-sm text-muted-foreground">Checking what is near {name}…</p>
      ) : (
        <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
          {LAYER_KEYS.map((k) => {
            const count = pois.filter((p) => p.layer === k).length;
            return <li key={k} className="flex justify-between gap-2 border-b py-1"><span>{LAYERS[k].label}</span><span className="text-muted-foreground">{count} within {RADIUS_M / 1000} km</span></li>;
          })}
        </ul>
      )}
    </div>
  );
}
