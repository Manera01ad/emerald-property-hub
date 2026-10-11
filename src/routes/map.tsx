import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { publicPropertiesQuery, type Property } from "@/lib/data";
import { formatINR } from "@/lib/format";
import { parseLocationInput, validLatLng, type LatLng } from "@/lib/mapurl";
import { evidenceFlags, valueProperty, type Kind } from "@/lib/valuation";
import { geocodeAddress, travelRoute } from "@/lib/maps.functions";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Map intelligence — PropWise AI" },
      { name: "description", content: "Satellite, hybrid and terrain maps of verified PropWise listings in Chennai, with value estimates and official land-record links." },
      { property: "og:title", content: "Map intelligence — PropWise AI" },
      { property: "og:description", content: "Explore plots and properties on satellite maps. Imagery is for orientation only — never a legal boundary." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MapPage,
});

const VIEWS = [["roadmap", "Roadmap"], ["satellite", "Satellite"], ["hybrid", "Hybrid"], ["terrain", "Terrain"]] as const;
const OFFICIAL = [
  ["Patta / Chitta & A-Register (TN e-Services)", "https://eservices.tn.gov.in/"],
  ["Encumbrance certificate & guideline value (TNREGINET)", "https://tnreginet.gov.in/"],
  ["TNRERA project registrations", "https://rera.tn.gov.in/"],
  ["CMDA planning permissions (Chennai)", "https://www.cmdachennai.gov.in/"],
  ["DTCP layout approvals (outside CMA)", "https://www.dtcp.tn.gov.in/"],
] as const;
const CHENNAI = { lat: 13.0827, lng: 80.2707 };

declare global { interface Window { __pwMapsReady?: () => void; google?: any } }
let loader: Promise<void> | null = null;
function loadMaps(): Promise<void> {
  if (window.google?.maps?.Map) return Promise.resolve();
  if (loader) return loader;
  const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
  const ch = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"] ?? "";
  if (!key) return Promise.reject(new Error("Google Maps key missing"));
  loader = new Promise((resolve, reject) => {
    window.__pwMapsReady = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__pwMapsReady&channel=${ch}`;
    s.async = true;
    s.onerror = () => { loader = null; reject(new Error("Google Maps failed to load")); };
    document.head.appendChild(s);
  });
  return loader;
}

function MapPage() {
  const { data: props = [], error: propsError } = useQuery(publicPropertiesQuery);
  const { session } = useSession();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const pin = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [mapErr, setMapErr] = useState("");
  const [view, setView] = useState<string>("hybrid");
  const [input, setInput] = useState("");
  const [address, setAddress] = useState("");
  const [msg, setMsg] = useState("");
  const [point, setPoint] = useState<{ p: LatLng; label: string; approx: boolean } | null>(null);
  const [selected, setSelected] = useState<Property | null>(null);
  const geocode = useServerFn(geocodeAddress);

  const located = props.filter((p) => validLatLng(p.latitude, p.longitude));

  useEffect(() => {
    if (window.location.hostname.includes("-devserver-")) { setStatus("error"); setMapErr("The live map is hidden in this private preview. Open the published site to see it."); return; }
    (window as any).gm_authFailure = () => { setStatus("error"); setMapErr("Google Maps refused this website address. The map works only on the PropWise site addresses the key allows."); };
    loadMaps().then(() => {
      if (!el.current) return;
      const g = window.google.maps;
      map.current = new g.Map(el.current, { center: CHENNAI, zoom: 11, mapTypeId: "hybrid", clickableIcons: false, mapTypeControl: false, streetViewControl: false });
      setStatus("ready");
    }).catch((e: Error) => { setStatus("error"); setMapErr(e.message); });
  }, []);

  useEffect(() => { map.current?.setMapTypeId(view); }, [view, status]);

  useEffect(() => {
    if (status !== "ready") return;
    const g = window.google.maps;
    markers.current.forEach((m) => m.setMap(null));
    markers.current = located.map((p) => {
      const m = new g.Marker({ map: map.current, position: { lat: Number(p.latitude), lng: Number(p.longitude) }, title: p.title });
      m.addListener("click", () => setSelected(p));
      return m;
    });
  }, [status, located.length]);

  function goTo(p: LatLng, label: string, approx: boolean) {
    setPoint({ p, label, approx });
    if (status !== "ready") return;
    map.current.setCenter(p); map.current.setZoom(18);
    pin.current?.setMap(null);
    pin.current = new window.google.maps.Marker({ map: map.current, position: p, title: label, opacity: 0.8 });
  }

  function onPaste() {
    const r = parseLocationInput(input);
    if (!r.ok) return setMsg(r.error);
    setMsg(""); goTo(r.point, "Pasted location", false);
  }
  async function onSearch() {
    if (!session) return setMsg("Please sign in to search addresses (this keeps Google usage under control).");
    if (address.trim().length < 3) return setMsg("Type at least 3 characters.");
    setMsg("Searching…");
    try {
      const res = await geocode({ data: { address } });
      if (!res.length) return setMsg("No match found for that address.");
      const top = res[0]!;
      setMsg(""); goTo({ lat: top.lat, lng: top.lng }, top.address, top.approximate);
    } catch (e) { setMsg((e as Error).message); }
  }
  function pickProperty(id: string) {
    const p = props.find((x) => x.id === id); if (!p) return;
    setSelected(p);
    const ll = validLatLng(p.latitude, p.longitude);
    if (ll) goTo(ll, p.title, true); else setMsg("This listing has no map location recorded yet.");
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="font-display text-3xl text-primary md:text-4xl">Map intelligence</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Satellite imagery is for orientation only. It is never used to draw legal plot boundaries, judge ownership, or feed our value estimates.</p>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="flex gap-2"><Input aria-label="Google Maps link or coordinates" placeholder="Google Maps link or 13.08, 80.27" value={input} onChange={(e) => setInput(e.target.value)} /><Button onClick={onPaste}>Go</Button></div>
        <div className="flex gap-2"><Input aria-label="Address" placeholder="Search an address" value={address} onChange={(e) => setAddress(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSearch()} /><Button variant="outline" onClick={onSearch}>Search</Button></div>
        <select aria-label="Choose a listing" className="h-10 rounded-md border bg-background px-3 text-sm" value={selected?.id ?? ""} onChange={(e) => pickProperty(e.target.value)}>
          <option value="">{props.length ? "Choose a listing…" : "No verified listings live yet"}</option>
          {props.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </div>
      {msg && <p role="status" className="mt-2 text-sm text-destructive">{msg}</p>}
      {propsError && <p className="mt-2 text-sm text-destructive">Couldn't load listings. Please refresh.</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {VIEWS.map(([v, l]) => <Button key={v} size="sm" variant={view === v ? "default" : "outline"} onClick={() => setView(v)}>{l}</Button>)}
        <span className="self-center text-xs text-muted-foreground">{located.length} of {props.length} live listings have a map location</span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="relative h-[420px] overflow-hidden rounded-xl border bg-muted md:h-[560px]">
          <div ref={el} className="h-full w-full" />
          {status !== "ready" && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
              {status === "loading" ? "Loading map…" : mapErr}
            </div>
          )}
          {point && <div className="absolute bottom-2 left-2 rounded bg-background/90 px-2 py-1 text-xs">{point.label} · {point.p.lat.toFixed(5)}, {point.p.lng.toFixed(5)}{point.approx && " · approximate location"}</div>}
        </div>
        <aside className="space-y-4 rounded-xl border p-4 text-sm">
          {selected ? <PropertyPanel p={selected} pool={props} signedIn={!!session} /> : <p className="text-muted-foreground">Choose a listing or click a pin to see its details. {props.length === 0 && "No verified listings are live yet."}</p>}
          <div>
            <p className="font-semibold">Official Tamil Nadu records</p>
            <ul className="mt-2 space-y-1">{OFFICIAL.map(([l, u]) => <li key={u}><a className="text-primary underline" href={u} target="_blank" rel="noopener noreferrer">{l}</a></li>)}</ul>
            <p className="mt-2 text-xs text-muted-foreground">Check ownership and approvals yourself on these sites or with a lawyer. PropWise does not verify them automatically.</p>
          </div>
          <Button asChild className="w-full"><Link to="/consult">Request a plot intelligence report</Link></Button>
          <p className="text-xs text-muted-foreground">Map data © Google. Distances shown elsewhere as "straight-line" are not road distances.</p>
        </aside>
      </div>
    </div>
  );
}

function PropertyPanel({ p, pool, signedIn }: { p: Property; pool: Property[]; signedIn: boolean }) {
  const route = useServerFn(travelRoute);
  const [dest, setDest] = useState("");
  const [trip, setTrip] = useState("");
  const area = Number(p.property_type === "plot" ? p.land_area_sqft : p.built_area_sqft ?? p.land_area_sqft) || 0;
  const comps = pool.filter((c) => c.id !== p.id && c.location === p.location && c.property_type === p.property_type)
    .map((c) => ({ price: Number(c.asking_price), area_sqft: Number(p.property_type === "plot" ? c.land_area_sqft : c.built_area_sqft ?? c.land_area_sqft) || 0, kind: "asking" as const }));
  const v = valueProperty({ kind: p.property_type as Kind, area_sqft: area, comparables: comps, guideline_value_per_sqft: p.guideline_value && area ? Number(p.guideline_value) / area : null });
  const flags = evidenceFlags(p);
  const ll = validLatLng(p.latitude, p.longitude);
  const na = <span className="text-muted-foreground">Not available</span>;
  const row = (k: string, val: React.ReactNode) => <div className="flex justify-between gap-3 border-b py-1"><span className="text-muted-foreground">{k}</span><span className="text-right">{val ?? na}</span></div>;

  async function onTrip() {
    if (!ll) return setTrip("This listing has no map location, so travel can't be worked out.");
    const r = parseLocationInput(dest);
    if (!r.ok) return setTrip(r.error);
    setTrip("Working out route…");
    try {
      const res = await route({ data: { from: ll, to: r.point, mode: "DRIVE" } });
      setTrip(res ? `About ${res.minutes} min by car, ${res.km} km by road (Google Routes, typical traffic not included).` : "Google found no route.");
    } catch (e) { setTrip((e as Error).message); }
  }

  return (
    <div className="space-y-3">
      <p className="font-display text-lg text-primary">{p.title}</p>
      {row("Type", p.property_type?.replace("_", " "))}
      {row("Area", area ? `${area.toLocaleString("en-IN")} sq ft` : null)}
      {row("Asking price", p.asking_price ? formatINR(Number(p.asking_price)) : null)}
      {row("Value estimate", v.mid != null ? `${formatINR(v.low)} – ${formatINR(v.high)} (${v.confidence})` : "Not enough evidence")}
      {row("Comparables used", String(comps.length))}
      {row("Survey number", p.survey_number)}
      {row("Verification", p.verification_status)}
      {row("Last updated", p.updated_at ? new Date(p.updated_at).toLocaleDateString("en-IN") : null)}
      {row("Map location", ll ? "Approximate pin" : null)}
      {row("Plot boundary", "No authorised survey or layout data")}
      {flags.length > 0 && <ul className="list-disc pl-5 text-xs text-muted-foreground">{flags.slice(0, 5).map((f) => <li key={f}>{f}</li>)}</ul>}
      <Link to="/properties/$id" params={{ id: p.id }} className="text-primary underline">Open full details</Link>
      <div className="space-y-2 pt-2">
        <p className="font-semibold">Travel by road</p>
        {signedIn ? (<>
          <div className="flex gap-2"><Input aria-label="Destination coordinates" placeholder="Destination: 13.0, 80.2 or Maps link" value={dest} onChange={(e) => setDest(e.target.value)} /><Button size="sm" variant="outline" onClick={onTrip}>Route</Button></div>
          {trip && <p className="text-xs">{trip}</p>}
        </>) : <p className="text-xs text-muted-foreground">Sign in to check road travel times.</p>}
      </div>
    </div>
  );
}
