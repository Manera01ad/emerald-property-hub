import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { z } from "zod";
import { PropertyCard } from "@/components/PropertyCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { APPROVALS, AVAILABILITY, MARKETS, PROPERTY_TYPES } from "@/lib/constants";
import { costRulesFrom, publicPropertiesQuery, useSettings } from "@/lib/data";
import { purchaseCost } from "@/lib/deal";

const searchSchema = z.object({
  location: z.string().optional(),
  type: z.string().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  bedrooms: z.number().optional(),
  minLand: z.number().optional(),
  approval: z.string().optional(),
  availability: z.string().optional(),
  allInclusive: z.boolean().optional(),
});
type Search = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/properties/")({
  staticData: { sitemap: true },
  validateSearch: searchSchema,
  head: () => ({
    links: [{ rel: "canonical", href: "https://emerald-property-hub.lovable.app/properties" }],
    meta: [
      { property: "og:url", content: "https://emerald-property-hub.lovable.app/properties" },
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
  const rules = costRulesFrom(settings);
  const set = (patch: Partial<Search>) => navigate({ search: (prev) => ({ ...prev, ...patch }) });
  const num = (v: string) => (v ? Number(v) : undefined);

  const results = useMemo(() => {
    return (data ?? []).filter((p) => {
      const price = s.allInclusive ? purchaseCost(p, rules).total : Number(p.asking_price);
      if (s.location && p.location !== s.location) return false;
      if (s.type && p.property_type !== s.type) return false;
      if (s.minPrice && price < s.minPrice * 1e5) return false;
      if (s.maxPrice && price > s.maxPrice * 1e5) return false;
      if (s.bedrooms && (p.bedrooms ?? 0) < s.bedrooms) return false;
      if (s.minLand && (Number(p.land_area_sqft) || 0) < s.minLand) return false;
      if (s.approval && !p.approvals.includes(s.approval)) return false;
      if (s.availability && p.availability !== s.availability) return false;
      return true;
    });
  }, [data, s, rules]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-4xl">Find a property</h1>
      <p className="mt-2 text-muted-foreground">Only listings with owner or developer permission are shown.</p>
      <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="h-fit space-y-4 rounded-xl border bg-card p-5 shadow-card lg:sticky lg:top-20">
          <div className="space-y-1.5"><Label>Location</Label>
            <select className={sel} value={s.location ?? ""} onChange={(e) => set({ location: e.target.value || undefined })}>
              <option value="">All</option>{MARKETS.map((m) => <option key={m}>{m}</option>)}
            </select></div>
          <div className="space-y-1.5"><Label>Type</Label>
            <select className={sel} value={s.type ?? ""} onChange={(e) => set({ type: e.target.value || undefined })}>
              <option value="">All</option>{PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select></div>
          <div className="space-y-1.5"><Label>Budget (₹ lakhs)</Label>
            <div className="flex gap-2">
              <Input type="number" placeholder="Min" defaultValue={s.minPrice} onBlur={(e) => set({ minPrice: num(e.target.value) })} />
              <Input type="number" placeholder="Max" defaultValue={s.maxPrice} onBlur={(e) => set({ maxPrice: num(e.target.value) })} />
            </div>
            <label className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
              <Checkbox checked={!!s.allInclusive} onCheckedChange={(v) => set({ allInclusive: v === true || undefined })} />
              All-inclusive (incl. estimated duties & fees)
            </label>
          </div>
          <div className="space-y-1.5"><Label>Min bedrooms</Label>
            <Input type="number" min={0} defaultValue={s.bedrooms} onBlur={(e) => set({ bedrooms: num(e.target.value) })} /></div>
          <div className="space-y-1.5"><Label>Min land area (sq ft)</Label>
            <Input type="number" min={0} defaultValue={s.minLand} onBlur={(e) => set({ minLand: num(e.target.value) })} /></div>
          <div className="space-y-1.5"><Label>Approval</Label>
            <select className={sel} value={s.approval ?? ""} onChange={(e) => set({ approval: e.target.value || undefined })}>
              <option value="">Any</option>{APPROVALS.map((a) => <option key={a}>{a}</option>)}
            </select></div>
          <div className="space-y-1.5"><Label>Availability</Label>
            <select className={sel} value={s.availability ?? ""} onChange={(e) => set({ availability: e.target.value || undefined })}>
              <option value="">Any</option>{Object.entries(AVAILABILITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <Button variant="outline" className="w-full" onClick={() => navigate({ search: {} })}>Reset filters</Button>
        </aside>
        <div>
          <p className="mb-4 text-sm text-muted-foreground">{isLoading ? "Loading…" : `${results.length} properties`}</p>
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
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{results.map((p) => <PropertyCard key={p.id} p={p} />)}</div>
          )}
        </div>
      </div>
    </div>
  );
}
