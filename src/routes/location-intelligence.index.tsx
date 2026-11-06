import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AreaIntelCard } from "@/components/AreaIntelCard";
import type { AreaSummary } from "@/lib/area-intel";
import { areaPoint } from "@/lib/areas";
import { searchString } from "@/lib/search-params";
import { siteUrl } from "@/lib/site";

const URL = siteUrl("/location-intelligence");
const TITLE = "Location intelligence for Chennai areas — PropWise AI";
const DESC = "Water bodies, parks, bus and train access and height above sea level for Chennai localities, from open map data.";

export const Route = createFileRoute("/location-intelligence/")({
  staticData: { sitemap: true },
  validateSearch: z.object({ area: searchString }),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: URL },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: LocationIntelPage,
});

function LocationIntelPage() {
  const q = useQuery({
    queryKey: ["area-intelligence"],
    queryFn: async () => {
      const { data, error } = await supabase.from("area_intelligence").select("area, city, summary, fetched_at").eq("is_published", true).order("area");
      if (error) throw error;
      return data ?? [];
    },
  });
  const search = Route.useSearch();
  const [area, setArea] = useState(search.area ?? "");
  const rows = q.data ?? [];
  const current = rows.find((r) => r.area === area) ?? rows[0];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl">Location intelligence</h1>
      <p className="mt-1 text-sm text-muted-foreground">What's around each area: water, parks, transport and height above sea level. These are estimates from open map data, not a flood or legal check.</p>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <Button asChild variant="outline" size="sm"><Link to="/map">Look up an exact location</Link></Button>
        <Button asChild variant="outline" size="sm"><Link to="/infrastructure">Infrastructure projects</Link></Button>
        <Button asChild variant="outline" size="sm"><Link to="/location-intelligence/compare" search={{ a: "", b: "" }} data-testid="compare-localities-link">Compare two localities</Link></Button>
      </div>

      <div className="mt-6 rounded-xl border bg-card p-4 shadow-card md:p-6">
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : q.isError ? (
          <p className="text-sm text-destructive">Couldn't load area information. Please try again.</p>
        ) : rows.length === 0 ? (
          <div className="text-sm">
            <p className="font-medium">No areas have been published yet.</p>
            <p className="mt-1 text-muted-foreground">We're checking area data before showing it. <Link to="/consult" className="underline">Ask us about an area</Link> in the meantime.</p>
          </div>
        ) : current ? (
          <>
            <label className="text-sm">Area
              <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm md:w-72" value={current.area} onChange={(e) => setArea(e.target.value)}>
                {rows.map((r) => <option key={r.area} value={r.area}>{r.area}</option>)}
              </select>
            </label>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl">{current.area}, {current.city}</h2>
              <Button asChild size="sm"><Link to="/explore" search={areaPoint("Chennai", current.area) ? { area: current.area } : {}}>See homes in {current.area}</Link></Button>
            </div>
            <div className="mt-3"><AreaIntelCard s={current.summary as unknown as AreaSummary} fetchedAt={current.fetched_at} /></div>
          </>
        ) : null}
      </div>
    </div>
  );
}
