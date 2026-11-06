import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { publicPropertiesQuery, type Property } from "@/lib/data";
import { formatINR } from "@/lib/format";
import { parseLocationInput, validLatLng, type LatLng } from "@/lib/mapurl";
import { evidenceFlags, valueProperty, type Kind } from "@/lib/valuation";
import { transactionTypeOf } from "@/lib/transaction";
import { searchLocation } from "@/lib/open-location-search";
import { useSession } from "@/lib/auth";
import { LocationMap } from "@/components/LocationMap";
import type { MapView } from "@/lib/map-layers";

export const Route = createFileRoute("/map")({
  staticData: { sitemap: true },
  head: () => ({
    links: [{ rel: "canonical", href: "https://emerald-property-hub.lovable.app/map" }],
    meta: [
      { property: "og:url", content: "https://emerald-property-hub.lovable.app/map" },
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

function MapPage() {
  const { data: props = [], error: propsError } = useQuery(publicPropertiesQuery);
  const { session } = useSession();
  const [view, setView] = useState<MapView>("hybrid");
  const [input, setInput] = useState("");
  const [address, setAddress] = useState("");
  const [msg, setMsg] = useState("");
  const [point, setPoint] = useState<{ p: LatLng; label: string; approx: boolean } | null>(null);
  const [selected, setSelected] = useState<Property | null>(null);
  const [searching, setSearching] = useState(false);

  const located = props.flatMap((p) => {
    const point = validLatLng(p.latitude, p.longitude);
    return point ? [{ id: p.id, point, label: p.title }] : [];
  });

  function goTo(p: LatLng, label: string, approx: boolean) {
    setPoint({ p, label, approx });
  }

  function onPaste() {
    const r = parseLocationInput(input);
    if (!r.ok) return setMsg(r.error);
    setMsg(""); goTo(r.point, "Pasted location", false);
  }
  async function onSearch() {
    if (searching) return;
    if (address.trim().length < 3) return setMsg("Type at least 3 characters.");
    setSearching(true);
    setMsg("Searching…");
    try {
      const res = await searchLocation(address);
      if (!res.length) return setMsg("No match found for that address.");
      const top = res[0];
      if (!top) return setMsg("No match found for that address.");
      setMsg(""); goTo({ lat: top.lat, lng: top.lng }, top.address, top.approximate);
    } catch (e) { setMsg((e as Error).message); }
    finally { setSearching(false); }
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
        <div className="flex gap-2"><Input aria-label="Map link or coordinates" placeholder="Map link or 13.08, 80.27" value={input} onChange={(e) => setInput(e.target.value)} /><Button onClick={onPaste}>Go</Button></div>
        <div className="flex gap-2"><Input aria-label="Address" placeholder="Search an address" value={address} onChange={(e) => setAddress(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSearch()} /><Button variant="outline" disabled={searching} onClick={onSearch}>{searching ? "Searching…" : "Search"}</Button></div>
        <select aria-label="Choose a listing" className="h-10 rounded-md border bg-background px-3 text-sm" value={selected?.id ?? ""} onChange={(e) => pickProperty(e.target.value)}>
          <option value="">{props.length ? "Choose a listing…" : "No verified listings live yet"}</option>
          {props.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </div>
      {msg && <p role="status" className="mt-2 text-sm text-destructive">{msg}</p>}
      {propsError && <p className="mt-2 text-sm text-destructive">Couldn't load listings. Please refresh.</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {VIEWS.map(([v, l]) => <Button key={v} size="sm" aria-pressed={view === v} variant={view === v ? "default" : "outline"} onClick={() => setView(v)}>{l}</Button>)}
        <span className="self-center text-xs text-muted-foreground">{located.length} of {props.length} live listings have a map location</span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="relative h-[420px] overflow-hidden rounded-xl border bg-muted md:h-[560px]">
          <LocationMap center={CHENNAI} view={view} pins={located} focus={point} onSelect={(id) => setSelected(props.find((p) => p.id === id) ?? null)} />
          {point && <div className="pointer-events-none absolute bottom-7 left-2 z-[1000] max-w-[calc(100%-1rem)] rounded bg-background/90 px-2 py-1 text-xs">{point.label} · {point.p.lat.toFixed(5)}, {point.p.lng.toFixed(5)}{point.approx && " · approximate location"}</div>}
        </div>
        <aside className="space-y-4 rounded-xl border p-4 text-sm">
          {selected ? <PropertyPanel p={selected} pool={props} signedIn={!!session} /> : <p className="text-muted-foreground">Choose a listing or click a pin to see its details. {props.length === 0 && "No verified listings are live yet."}</p>}
          <div>
            <p className="font-semibold">Official Tamil Nadu records</p>
            <ul className="mt-2 space-y-1">{OFFICIAL.map(([l, u]) => <li key={u}><a className="text-primary underline" href={u} target="_blank" rel="noopener noreferrer">{l}</a></li>)}</ul>
            <p className="mt-2 text-xs text-muted-foreground">Check ownership and approvals yourself on these sites or with a lawyer. PropWise does not verify them automatically.</p>
          </div>
          <Button asChild className="w-full"><Link to="/consult">Request a plot intelligence report</Link></Button>
          <p className="text-xs text-muted-foreground">Terrain shows a topographic map, not a flood assessment. Address search: Photon / OpenStreetMap, best-effort availability. Distances marked "straight-line" are not road distances.</p>
        </aside>
      </div>
    </div>
  );
}

function PropertyPanel({ p, pool, signedIn }: { p: Property; pool: Property[]; signedIn: boolean }) {
  const [dest, setDest] = useState("");
  const [trip, setTrip] = useState("");
  const [routeLink, setRouteLink] = useState("");
  const area = Number(p.property_type === "plot" ? p.land_area_sqft : p.built_area_sqft ?? p.land_area_sqft) || 0;
  // Comparables and the value estimate are sale concepts, so a rent or lease listing is
  // excluded: a monthly figure would otherwise be priced as if it were a purchase.
  const comps = pool.filter((c) => c.id !== p.id && c.location === p.location && c.property_type === p.property_type && transactionTypeOf(c) === "buy" && transactionTypeOf(p) === "buy")
    .map((c) => ({ price: Number(c.asking_price), area_sqft: Number(p.property_type === "plot" ? c.land_area_sqft : c.built_area_sqft ?? c.land_area_sqft) || 0, kind: "asking" as const }));
  const v = valueProperty({ kind: p.property_type as Kind, area_sqft: area, comparables: comps, guideline_value_per_sqft: p.guideline_value && area ? Number(p.guideline_value) / area : null });
  const flags = evidenceFlags(p);
  const ll = validLatLng(p.latitude, p.longitude);
  const na = <span className="text-muted-foreground">Not available</span>;
  const row = (k: string, val: React.ReactNode) => <div className="flex justify-between gap-3 border-b py-1"><span className="text-muted-foreground">{k}</span><span className="text-right">{val ?? na}</span></div>;

  function onTrip() {
    setRouteLink("");
    if (!ll) return setTrip("This listing has no map location, so travel can't be worked out.");
    const r = parseLocationInput(dest);
    if (!r.ok) return setTrip(r.error);
    setTrip("");
    setRouteLink(`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${ll.lat}%2C${ll.lng}%3B${r.point.lat}%2C${r.point.lng}`);
  }

  return (
    <div className="space-y-3">
      <p className="font-display text-lg text-primary">{p.title}</p>
      {row("Type", p.property_type?.replace("_", " "))}
      {row("Area", area ? `${area.toLocaleString("en-IN")} sq ft` : null)}
      {row(transactionTypeOf(p) === "buy" ? "Asking price" : "Monthly figure", p.asking_price ? `${formatINR(Number(p.asking_price))}${transactionTypeOf(p) === "buy" ? "" : " a month"}` : null)}
      {transactionTypeOf(p) === "buy" && row("Value estimate", v.mid != null ? `${formatINR(v.low)} – ${formatINR(v.high)} (${v.confidence})` : "Not enough evidence")}
      {transactionTypeOf(p) === "buy" && row("Comparables used", String(comps.length))}
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
          {routeLink && <a href={routeLink} target="_blank" rel="noopener noreferrer" className="text-primary underline">Open road directions</a>}
        </>) : <p className="text-xs text-muted-foreground">Sign in to open road directions.</p>}
      </div>
    </div>
  );
}
