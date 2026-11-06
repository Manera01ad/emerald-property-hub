import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { z } from "zod";
import { PropertyCard } from "@/components/PropertyCard";
import { MyLocationBar } from "@/components/MyLocationBar";
import { RequirementsForm } from "@/components/RequirementsForm";
import { TransactionSelector } from "@/components/TransactionSelector";
import { EvidenceBadge } from "@/components/EvidenceBadge";
import { useMyLocation, useNearMeAccess } from "@/lib/my-location";
import { listingDistance } from "@/lib/nearme";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { APPROVALS, AVAILABILITY, PROPERTY_TYPES } from "@/lib/constants";
import { costRulesFrom, publicPropertiesQuery, useLocalities, useSettings } from "@/lib/data";
import { matchProperty } from "@/lib/buyer";
import { purchaseCost } from "@/lib/deal";
import { transactionTypeOf, type TransactionType } from "@/lib/transaction";
import {
  searchBoolean,
  searchEnum,
  searchInt,
  searchNumber,
  searchString,
} from "@/lib/search-params";
import { siteUrl } from "@/lib/site";

// Tolerant by design: a mistyped filter in the URL is dropped, never a 500.
const searchSchema = z.object({
  transaction: searchEnum(["buy", "rent", "lease"] as const),
  location: searchString,
  locality: searchString,
  type: searchString,
  minPrice: searchNumber,
  maxPrice: searchNumber,
  bedrooms: searchInt,
  minLand: searchInt,
  approval: searchString,
  availability: searchString,
  allInclusive: searchBoolean,
  verifiedOnly: searchBoolean,
});
type Search = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/properties/")({
  staticData: { sitemap: true },
  validateSearch: searchSchema,
  head: () => ({
    links: [{ rel: "canonical", href: siteUrl("/properties") }],
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: siteUrl("/properties") },
      { title: "Search Properties in Chennai — PropWise AI" },
      { name: "description", content: "Filter villas, houses, apartments and plots in Chennai by price, bedrooms, land area and approvals." },
      { property: "og:title", content: "Search Properties in Chennai — PropWise AI" },
      { property: "og:description", content: "Filter by location, all-inclusive budget, approvals and availability." },
    ],
  }),
  component: PropertiesPage,
});

const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

function PropertiesPage() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/properties/" });
  const { data, isLoading, isError } = useQuery(publicPropertiesQuery);
  const { data: settings } = useSettings();
  const { data: localities = [] } = useLocalities();
  const rules = costRulesFrom(settings);
  const set = (patch: Partial<Search>) => navigate({ search: (prev) => ({ ...prev, ...patch }) });
  const num = (v: string) => (v ? Number(v) : undefined);
  const nearAccess = useNearMeAccess();
  const me = useMyLocation();
  const origin = nearAccess ? me.origin : null;

  // Locality first: the shortlist is chosen before individual homes are compared.
  const localityMatches = useMemo(() => {
    const wanted = s.locality ?? s.location;
    return localities
      .filter((l) => !wanted || l.name === wanted)
      .map((l) => ({ locality: l, listings: (data ?? []).filter((p) => p.location === l.name) }));
  }, [localities, data, s.locality, s.location]);

  const distances = useMemo(() => new Map((data ?? []).flatMap((p) => { const d = origin ? listingDistance(p, origin) : null; return d ? [[p.id, d] as const] : []; })), [data, origin]);

  const results = useMemo(() => {
    const type = s.transaction ?? "buy";
    const monthly = type !== "buy";
    const list = (data ?? []).filter((p) => {
      // One listing list, filtered by the transaction type the visitor is shopping in.
      if (transactionTypeOf(p) !== type) return false;
      const price = s.allInclusive && !monthly ? purchaseCost(p, rules).total : Number(p.asking_price);
      if (s.location && p.location !== s.location) return false;
      if (s.locality && p.location !== s.locality) return false;
      if (s.type && p.property_type !== s.type) return false;
      // A monthly budget is stated in rupees, a sale budget in lakhs.
      const budgetFactor = monthly ? 1 : 1e5;
      if (s.minPrice && price < s.minPrice * budgetFactor) return false;
      if (s.maxPrice && price > s.maxPrice * budgetFactor) return false;
      if (s.bedrooms && (p.bedrooms ?? 0) < s.bedrooms) return false;
      if (s.minLand && (Number(p.land_area_sqft) || 0) < s.minLand) return false;
      if (s.approval && !p.approvals.includes(s.approval)) return false;
      if (s.availability && p.availability !== s.availability) return false;
      if (s.verifiedOnly && p.verification_status !== "verified") return false;
      if (origin && (distances.get(p.id)?.km ?? Infinity) > me.radiusKm) return false;
      return true;
    });
    return origin ? list.sort((a, b) => (distances.get(a.id)?.km ?? 0) - (distances.get(b.id)?.km ?? 0)) : list;
  }, [data, s, rules, origin, me.radiusKm, distances]);

  // Match explanations only when the buyer has given something to match against.
  const hasRequirements = !!(s.maxPrice || s.locality || s.location || s.type || s.bedrooms || s.minLand);
  const matches = useMemo(() => {
    if (!hasRequirements) return new Map<string, ReturnType<typeof matchProperty>>();
    const transaction = s.transaction ?? "buy";
    const pref = {
      intent: transaction,
      property_types: s.type ? [s.type] : [],
      budget: s.maxPrice ? s.maxPrice * (transaction === "buy" ? 1e5 : 1) : null,
      preferred_locations: s.locality ? [s.locality] : s.location ? [s.location] : [],
      bedrooms: s.bedrooms ?? null,
      min_area_sqft: s.minLand ?? null,
    };
    return new Map(results.map((p) => [p.id, matchProperty(p, pref, rules)]));
  }, [results, hasRequirements, s, rules]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-4xl">Find a property</h1>
      <p className="mt-2 text-muted-foreground">Only listings with owner or developer permission are shown.</p>

      <div className="mt-4">
        <TransactionSelector
          value={s.transaction ?? "buy"}
          onChange={(transaction) => set({ transaction, maxPrice: undefined, minPrice: undefined, allInclusive: undefined })}
        />
      </div>

      <div className="mt-6">
        <RequirementsForm
          transaction={s.transaction ?? "buy"}
          value={{ budgetLakh: s.maxPrice, location: s.locality, type: s.type, bedrooms: s.bedrooms, minArea: s.minLand, verifiedOnly: s.verifiedOnly }}
          onChange={(patch) => set({
            maxPrice: patch.budgetLakh, locality: patch.location, type: patch.type,
            bedrooms: patch.bedrooms, minLand: patch.minArea, verifiedOnly: patch.verifiedOnly,
          })}
        />
      </div>

      <section className="mt-8">
        <h2 className="text-2xl">Start with a locality</h2>
        <p className="mt-1 text-sm text-muted-foreground">Pick the area first, then compare homes inside it. Each locality page lists the evidence we hold and says unknown where we have none.</p>
        {isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
        ) : localityMatches.length === 0 ? (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><EvidenceBadge evidence="UNKNOWN" /> No published locality matches that name yet.</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {localityMatches.map(({ locality, listings }) => (
              <div key={locality.id} className="rounded-xl border bg-card p-4 shadow-card">
                <p className="font-medium">{locality.name}</p>
                <p className="text-xs text-muted-foreground">{locality.corridor} · tier {locality.tier}</p>
                <p className="mt-2 text-sm text-muted-foreground">{listings.length} published listing{listings.length === 1 ? "" : "s"}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline"><Link to="/location-intelligence/$area" params={{ area: locality.slug }}>Locality guide</Link></Button>
                  <Button asChild size="sm"><Link to="/properties" search={{ locality: locality.name }}>See homes</Link></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="h-fit space-y-4 rounded-xl border bg-card p-5 shadow-card lg:sticky lg:top-20">
          <div className="space-y-1.5"><Label htmlFor="f-locality">Locality</Label>
            <select id="f-locality" className={sel} value={s.locality ?? ""} onChange={(e) => set({ locality: e.target.value || undefined, location: undefined })}>
              <option value="">Any locality</option>{localities.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
            </select></div>
          <div className="space-y-1.5"><Label htmlFor="f-type">Type</Label>
            <select id="f-type" className={sel} value={s.type ?? ""} onChange={(e) => set({ type: e.target.value || undefined })}>
              <option value="">All</option>{PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select></div>
          <div className="space-y-1.5"><Label htmlFor="f-min-price">Budget (₹ lakhs)</Label>
            <div className="flex gap-2">
              <Input id="f-min-price" type="number" aria-label="Minimum budget in lakhs" placeholder="Min" defaultValue={s.minPrice} onBlur={(e) => set({ minPrice: num(e.target.value) })} />
              <Input type="number" aria-label="Maximum budget in lakhs" placeholder="Max" defaultValue={s.maxPrice} onBlur={(e) => set({ maxPrice: num(e.target.value) })} />
            </div>
            <label className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
              <Checkbox checked={!!s.allInclusive} onCheckedChange={(v) => set({ allInclusive: v === true || undefined })} />
              All-inclusive (incl. estimated duties &amp; fees)
            </label>
          </div>
          <div className="space-y-1.5"><Label htmlFor="f-bedrooms">Min bedrooms</Label>
            <Input id="f-bedrooms" type="number" min={0} defaultValue={s.bedrooms} onBlur={(e) => set({ bedrooms: num(e.target.value) })} /></div>
          <div className="space-y-1.5"><Label htmlFor="f-min-land">Min land area (sq ft)</Label>
            <Input id="f-min-land" type="number" min={0} defaultValue={s.minLand} onBlur={(e) => set({ minLand: num(e.target.value) })} /></div>
          <div className="space-y-1.5"><Label htmlFor="f-approval">Approval</Label>
            <select id="f-approval" className={sel} value={s.approval ?? ""} onChange={(e) => set({ approval: e.target.value || undefined })}>
              <option value="">Any</option>{APPROVALS.map((a) => <option key={a}>{a}</option>)}
            </select></div>
          <div className="space-y-1.5"><Label htmlFor="f-availability">Availability</Label>
            <select id="f-availability" className={sel} value={s.availability ?? ""} onChange={(e) => set({ availability: e.target.value || undefined })}>
              <option value="">Any</option>{Object.entries(AVAILABILITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked={!!s.verifiedOnly} onCheckedChange={(v) => set({ verifiedOnly: v === true || undefined })} />
            Documents verified only
          </label>
          <Button variant="outline" className="w-full" onClick={() => navigate({ search: {} })}>Reset filters</Button>
        </aside>
        <div>
          <MyLocationBar className="mb-3" />
          <p className="mb-4 text-sm text-muted-foreground">{isLoading ? "Loading…" : `${results.length} properties${origin ? `, nearest first` : ""}`}</p>
          {isError ? (
            <div className="rounded-xl border border-dashed p-12 text-center text-destructive">Couldn't load listings. Please refresh to try again.</div>
          ) : !isLoading && (data ?? []).length === 0 ? (
            <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
              <p className="font-medium text-foreground">No verified listings are live yet.</p>
              <p className="mt-1 text-sm">We only show properties whose owner or developer has given us permission. Tell us what you need and a consultant will help you search.</p>
              <Button asChild variant="gold" className="mt-4"><Link to="/consult">Request a consultation</Link></Button>
            </div>
          ) : !isLoading && results.length === 0 ? (
            <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">No listings match these filters yet.</div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{results.map((p) => {
              const d = distances.get(p.id);
              const m = matches.get(p.id);
              return (
                <div key={p.id}>
                  <PropertyCard p={p} />
                  {d && <p className="mt-1 text-xs text-muted-foreground">{d.exact ? "" : "~"}{d.km.toFixed(1)} km from you</p>}
                  {m && (
                    <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                      <EvidenceBadge evidence={m.overall != null ? "ESTIMATE" : "UNKNOWN"} />
                      {m.overall != null ? `${m.overall}/100 against your requirements` : "Not enough data to match against your requirements"}
                    </p>
                  )}
                </div>
              );
            })}</div>
          )}
        </div>
      </div>
    </div>
  );
}
