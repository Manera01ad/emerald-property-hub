import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AreaBrief } from "@/components/AreaBrief";
import { useMyLocation, useNearMeAccess } from "@/lib/my-location";
import { ResearchBrief } from "@/components/ResearchBrief";
import { PROPERTY_TYPES, typeLabel } from "@/lib/constants";
import { costRulesFrom, publicPropertiesQuery, useSettings, type Property } from "@/lib/data";
import { purchaseCost } from "@/lib/deal";
import { formatINR } from "@/lib/format";
import { LAYERS, LAYER_KEYS, bboxKey, distanceKm, livability, overpassBboxQuery, overpassQuery, parseOverpass, snapBbox, walkMinutes, type LayerKey, type PoiWithDistance } from "@/lib/livability";
import { AREAS, CITIES, RADIUS_OPTIONS, areaPoint } from "@/lib/areas";
import { OSM_STYLE, loadMapLibre } from "@/lib/maplibre";
import { validLatLng, type LatLng } from "@/lib/mapurl";

export const Route = createFileRoute("/explore")({
  staticData: { sitemap: true },
  validateSearch: z.object({ area: z.string().optional() }),
  head: () => ({
    links: [{ rel: "canonical", href: "https://emerald-property-hub.lovable.app/explore" }],
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://emerald-property-hub.lovable.app/explore" },
      { title: "Explore Chennai Properties on a Map — PropWise AI" },
      { name: "description", content: "See homes with the schools, hospitals, shops and transit around them. Pick your area and see homes nearby." },
      { property: "og:title", content: "Explore Chennai Properties on a Map — PropWise AI" },
      { property: "og:description", content: "Live the area before you buy: nearby schools, hospitals, food, shops and transit for every listing." },
    ],
  }),
  component: ExplorePage,
});

const RADIUS_M = 2000;
const OVERPASS = "https://overpass-api.de/api/interpreter";
const MIN_PLACES_ZOOM = 13;
const CHENNAI: LatLng = { lat: 12.9, lng: 80.1 };

type Pt = Property & { lat: number; lng: number };

function useNearby(p: Pt | null) {
  return useQuery({
    queryKey: ["nearby", p?.id],
    enabled: !!p,
    staleTime: 1000 * 60 * 60 * 24,
    retry: 1,
    queryFn: async (): Promise<PoiWithDistance[]> => {
      const res = await fetch(OVERPASS, { method: "POST", body: new URLSearchParams({ data: overpassQuery(p!.lat, p!.lng, RADIUS_M) }) });
      if (!res.ok) throw new Error(`Map data service busy (${res.status})`);
      const json = (await res.json()) as { elements?: any[] };
      return parseOverpass(json.elements ?? [], p!.lat, p!.lng);
    },
  });
}

function scoreTone(n: number) {
  return n >= 70 ? "bg-emerald-600" : n >= 40 ? "bg-amber-500" : "bg-rose-600";
}

function ExplorePage() {
  const { data: all = [], isLoading } = useQuery(publicPropertiesQuery);
  const { data: settings } = useSettings();
  const rules = costRulesFrom(settings);

  const [type, setType] = useState("");
  const [maxLakh, setMaxLakh] = useState("");
  const [city, setCity] = useState(CITIES[0]!);
  const search = Route.useSearch();
  const nearAccess = useNearMeAccess();
  const mine = useMyLocation();
  const [area, setAreaState] = useState(search.area && areaPoint(CITIES[0]!, search.area) ? search.area : nearAccess && mine.area ? mine.area : "");
  const [officeKm, setOfficeKmState] = useState(String(nearAccess ? mine.radiusKm : 10));
  // Keep the shared "near me" setting in step with what is chosen here (administrators only for now).
  const setArea = (a: string) => { setAreaState(a); if (nearAccess) mine.setArea(a || null); };
  const setOfficeKm = (km: string) => { setOfficeKmState(km); if (nearAccess && Number(km)) mine.setRadius(Number(km)); };
  const office: LatLng | null = area ? areaPoint(city, area) : null;
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({ school: true, hospital: true, food: false, grocery: true, transit: true });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapErr, setMapErr] = useState("");

  const located = useMemo(() => all.flatMap((p) => { const ll = validLatLng(p.latitude, p.longitude); return ll ? [{ ...p, ...ll } as Pt] : []; }), [all]);
  const visible = useMemo(() => located.filter((p) => {
    if (type && p.property_type !== type) return false;
    if (maxLakh && p.asking_price > Number(maxLakh) * 1e5) return false;
    if (office && distanceKm(office.lat, office.lng, p.lat, p.lng) > (Number(officeKm) || 10)) return false;
    return true;
  }), [located, type, maxLakh, office, officeKm]);

  const selected = visible.find((p) => p.id === selectedId) ?? null;
  const nearby = useNearby(selected);
  const live = useMemo(() => (nearby.data ? livability(nearby.data) : null), [nearby.data]);

  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const pinMarkers = useRef<any[]>([]);
  const poiMarkers = useRef<any[]>([]);
  const officeMarker = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [viewPois, setViewPois] = useState<PoiWithDistance[]>([]);
  const [placesState, setPlacesState] = useState<"zoom" | "loading" | "ok" | "error">("zoom");
  const placeCache = useRef(new Map<string, PoiWithDistance[]>());

  useEffect(() => {
    let dead = false;
    loadMapLibre().then((ml) => {
      if (dead || !mapEl.current) return;
      map.current = new ml.Map({
        container: mapEl.current,
        center: [CHENNAI.lng, CHENNAI.lat],
        zoom: 10,
        style: OSM_STYLE,
      });
      map.current.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
      setReady(true);
    }).catch((e) => setMapErr(e.message));
    return () => { dead = true; map.current?.remove(); map.current = null; };
  }, []);

  // Property pins
  useEffect(() => {
    if (!ready) return;
    const ml = window.maplibregl;
    pinMarkers.current.forEach((m) => m.remove());
    pinMarkers.current = visible.map((p) => {
      const el = document.createElement("button");
      el.type = "button";
      el.textContent = formatINR(p.asking_price);
      el.setAttribute("aria-label", `${p.title}, ${formatINR(p.asking_price)}`);
      el.className = `rounded-full border-2 border-white px-2 py-0.5 text-xs font-semibold text-white shadow ${p.id === selectedId ? "bg-gold" : "bg-primary"}`;
      el.onclick = (ev) => { ev.stopPropagation(); setSelectedId(p.id); };
      return new ml.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map.current);
    });
    if (visible.length && !selectedId) {
      const b = new ml.LngLatBounds();
      visible.forEach((p) => b.extend([p.lng, p.lat]));
      map.current.fitBounds(b, { padding: 70, maxZoom: 14, duration: 0 });
    }
  }, [ready, visible, selectedId]);

  // Fly to selection
  useEffect(() => {
    if (ready && selected) map.current.flyTo({ center: [selected.lng, selected.lat], zoom: 14.5, duration: 600 });
  }, [ready, selected?.id]);

  // Places in the current map view, like a normal map: loads whenever the map stops moving at street level.
  useEffect(() => {
    if (!ready) return;
    const m = map.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ctl: AbortController | undefined;
    async function load() {
      if (m.getZoom() < MIN_PLACES_ZOOM) { setViewPois([]); setPlacesState("zoom"); return; }
      const bounds = m.getBounds();
      const box = snapBbox({ south: bounds.getSouth(), west: bounds.getWest(), north: bounds.getNorth(), east: bounds.getEast() });
      const key = bboxKey(box);
      const hit = placeCache.current.get(key);
      if (hit) { setViewPois(hit); setPlacesState("ok"); return; }
      ctl?.abort();
      ctl = new AbortController();
      setPlacesState("loading");
      try {
        const res = await fetch(OVERPASS, { method: "POST", body: new URLSearchParams({ data: overpassBboxQuery(box) }), signal: ctl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { elements?: any[] };
        const c = m.getCenter();
        const pois = parseOverpass(json.elements ?? [], c.lat, c.lng);
        placeCache.current.set(key, pois);
        setViewPois(pois);
        setPlacesState("ok");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setPlacesState("error");
      }
    }
    const onMove = () => { clearTimeout(timer); timer = setTimeout(load, 600); };
    m.on("moveend", onMove);
    onMove();
    return () => { clearTimeout(timer); ctl?.abort(); m.off("moveend", onMove); };
  }, [ready]);

  // Neighbourhood markers
  useEffect(() => {
    if (!ready) return;
    const ml = window.maplibregl;
    poiMarkers.current.forEach((m) => m.remove());
    const source = selected ? nearby.data ?? [] : viewPois;
    poiMarkers.current = source.filter((p) => layers[p.layer]).slice(0, 300).map((p) => {
      const el = document.createElement("div");
      el.style.cssText = `width:12px;height:12px;border-radius:9999px;background:${LAYERS[p.layer].color};border:2px solid #fff;box-shadow:0 0 2px #0006;cursor:pointer`;
      const popup = new ml.Popup({ offset: 10, closeButton: false }).setText(`${p.name} · ${LAYERS[p.layer].label}${selected ? ` · ${p.km.toFixed(1)} km` : ""}`);
      return new ml.Marker({ element: el }).setLngLat([p.lng, p.lat]).setPopup(popup).addTo(map.current);
    });
  }, [ready, nearby.data, viewPois, layers, selected?.id]);

  // Move the map to the chosen area
  useEffect(() => {
    if (ready && office) map.current.flyTo({ center: [office.lng, office.lat], zoom: 13 });
  }, [ready, office?.lat, office?.lng]);

  // Area marker
  useEffect(() => {
    if (!ready) return;
    officeMarker.current?.remove();
    officeMarker.current = null;
    if (office) officeMarker.current = new window.maplibregl.Marker({ color: "#0f172a" }).setLngLat([office.lng, office.lat]).addTo(map.current);
  }, [ready, office]);

  const cost = selected ? purchaseCost(selected, rules) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl">Explore locations</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm"><Link to="/properties">List view</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/map">Look up an exact location</Link></Button>
        </div>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Tap a price pin to see what is around the home. Neighbourhood data is from OpenStreetMap and may be incomplete — treat scores as estimates.</p>

      <div className="mt-5 grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[1fr_1fr_2.2fr]">
        <label className="text-sm">Type
          <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="text-sm">Max price (₹ lakh)
          <Input className="mt-1" inputMode="numeric" placeholder="e.g. 60" value={maxLakh} onChange={(e) => setMaxLakh(e.target.value.replace(/[^\d.]/g, ""))} />
        </label>
        <div className="text-sm">
          <span>Where do you want to live or work?</span>
          <div className="mt-1 grid grid-cols-[1fr_1.4fr_auto] gap-2">
            <select aria-label="City" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={city} onChange={(e) => { setCity(e.target.value); setArea(""); }}>
              {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select aria-label="Area" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">All areas</option>
              {Object.keys(AREAS[city] ?? {}).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select aria-label="Within distance" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={officeKm} onChange={(e) => setOfficeKm(e.target.value)} disabled={!area}>
              {RADIUS_OPTIONS.map((r) => <option key={r} value={r}>within {r} km</option>)}
            </select>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{area ? `Showing homes within ${officeKm} km of ${area}, measured in a straight line (not road distance).` : "Pick an area to see only homes near it."}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="relative">
          <div ref={mapEl} className="h-[70vh] min-h-[420px] w-full overflow-hidden rounded-xl border" />
          {mapErr && <p role="alert" className="absolute inset-x-3 top-3 rounded bg-destructive px-3 py-2 text-sm text-destructive-foreground">{mapErr}</p>}
          {!isLoading && !located.length && (
            <p className="pointer-events-none absolute inset-x-3 bottom-8 mx-auto w-fit max-w-full rounded-lg bg-background/95 px-3 py-2 text-center text-xs shadow">
              No homes with map locations yet. <Link to="/consult" className="pointer-events-auto underline">Tell us what you need</Link> and we will find homes for you.
            </p>
          )}
          {!selected && (
            <p className="pointer-events-none absolute bottom-8 left-3 rounded bg-background/95 px-2 py-1 text-xs shadow">
              {placesState === "zoom" ? "Zoom in to see schools, hospitals, shops and transit" : placesState === "loading" ? "Loading places…" : placesState === "error" ? "Place data is busy. Move the map to try again." : `${viewPois.filter((p) => layers[p.layer]).length} places shown`}
            </p>
          )}
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5 rounded-lg bg-background/95 p-2 shadow">
            {LAYER_KEYS.map((k) => (
              <button key={k} type="button" aria-pressed={layers[k]} onClick={() => setLayers((l) => ({ ...l, [k]: !l[k] }))}
                className={`flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${layers[k] ? "bg-foreground text-background" : "bg-background"}`}>
                <span className="h-2 w-2 rounded-full" style={{ background: LAYERS[k].color }} />{LAYERS[k].label}
              </button>
            ))}
          </div>
        </div>

        <aside className="rounded-xl border bg-card p-4">
          {!selected ? (
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{visible.length} home{visible.length === 1 ? "" : "s"} on the map</p>
              <p className="mt-2">Select a price pin to see its livability score, the nearest school, hospital, shop and transit stop, and the all-in cost.</p>
              {area && <AreaBrief area={area} />}
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{typeLabel(selected.property_type)} · {selected.location}</p>
                <h2 className="mt-1 text-xl">{selected.title}</h2>
                <p className="mt-1 text-lg font-semibold">{formatINR(selected.asking_price)}</p>
                {cost && <p className="text-xs text-muted-foreground">About {formatINR(cost.total)} all-in with stamp duty, registration and legal fees (estimate).</p>}
              </div>

              <div>
                <div className="flex items-center justify-between"><span className="font-medium">Livability</span>
                  {live && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold text-white ${scoreTone(live.score)}`}>{live.score}/100</span>}
                </div>
                {nearby.isLoading && <p className="mt-2 text-muted-foreground">Looking up the neighbourhood…</p>}
                {nearby.isError && <p role="alert" className="mt-2 text-destructive">{(nearby.error as Error).message}. <button className="underline" onClick={() => nearby.refetch()}>Try again</button></p>}
                {live && (
                  <ul className="mt-2 space-y-1.5">
                    {LAYER_KEYS.map((k) => {
                      const n = live.nearest[k];
                      return (
                        <li key={k} className="flex items-start justify-between gap-2">
                          <span className="flex items-center gap-1.5"><span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: LAYERS[k].color }} />{LAYERS[k].label}</span>
                          <span className="text-right text-muted-foreground">{n ? `${n.name} · ${n.km.toFixed(1)} km${n.km <= 1.5 ? ` (${walkMinutes(n.km)} min walk)` : ""}` : `none within ${RADIUS_M / 1000} km`}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div>
                <p className="mb-2 font-medium">Check before you pay</p>
                <ResearchBrief property={selected} rules={rules} compact />
              </div>

              <div className="flex gap-2">
                <Button asChild className="flex-1"><Link to="/properties/$id" params={{ id: selected.id }}>View details</Link></Button>
                <Button asChild variant="outline"><Link to="/consult">Ask an expert</Link></Button>
              </div>
              <button className="text-xs underline" onClick={() => setSelectedId(null)}>Back to all homes</button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
