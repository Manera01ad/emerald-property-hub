import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AreaIntelCard } from "@/components/AreaIntelCard";
import { FloodPanel } from "@/components/FloodPanel";
import { floodBrief, floodInputFromSummary } from "@/lib/flood";
import { EvidenceBadge } from "@/components/EvidenceBadge";
import { LocalityMap } from "@/components/LocalityMap";
import type { AreaSummary } from "@/lib/area-intel";
import { areaPoint } from "@/lib/areas";
import { localitiesQuery, publicPropertiesQuery, useSettings } from "@/lib/data";
import { priceContext } from "@/lib/price-context";
import { transactionTypeOf } from "@/lib/transaction";
import { infraStatusLabel } from "@/lib/infrastructure";
import { formatINR } from "@/lib/format";
import { findLocality } from "@/lib/localities";
import type { Evidence } from "@/lib/evidence";
import { siteUrl } from "@/lib/site";

const BASE = siteUrl("/location-intelligence");

export const Route = createFileRoute("/location-intelligence/$area")({
  staticData: { sitemap: false },
  head: ({ params }) => {
    const name = params.area.replace(/-/g, " ");
    const title = `${name} — locality intelligence — PropWise AI`;
    const description = `Published evidence about ${name}: what is around it, infrastructure with sources, asking-price context and open questions. Missing data is shown as unknown.`;
    return {
      links: [{ rel: "canonical", href: `${BASE}/${params.area}` }],
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: `${BASE}/${params.area}` },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: LocalityPage,
});

/** Infrastructure rows are limited to published rows by the table's public-read policy. */
function useInfrastructure(area: string) {
  return useQuery({
    queryKey: ["infra", "area", area],
    enabled: !!area,
    queryFn: async () => {
      const { data, error } = await supabase.from("infrastructure_projects").select("*").eq("area", area).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function Unknown({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex flex-wrap items-start gap-2 text-sm text-muted-foreground">
      <EvidenceBadge evidence="UNKNOWN" />
      <span>{children}</span>
    </p>
  );
}

function LocalityPage() {
  const { area } = Route.useParams();
  const [tab, setTab] = useState<"snapshot" | "map" | "sources">("snapshot");
  const localities = useQuery(localitiesQuery);
  const locality = findLocality(localities.data ?? [], area);
  const name = locality?.name ?? area.replace(/-/g, " ");

  const intel = useQuery({
    queryKey: ["area-intelligence", name],
    enabled: !!locality,
    queryFn: async () => {
      const { data, error } = await supabase.from("area_intelligence").select("area, city, summary, fetched_at").eq("is_published", true).ilike("area", name).limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
  const infra = useInfrastructure(name);
  const properties = useQuery(publicPropertiesQuery);
  const { data: settings } = useSettings();

  if (localities.isLoading) {
    return <div className="mx-auto max-w-4xl px-4 py-14"><p className="text-muted-foreground">Loading…</p></div>;
  }

  if (!locality) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-14">
        <h1 className="text-3xl">Unknown locality</h1>
        <p className="mt-2 text-muted-foreground">We have no published locality called “{name}”. We do not guess at an area we have not checked.</p>
        <Button asChild variant="gold" className="mt-6"><Link to="/location-intelligence">See the localities we have</Link></Button>
      </div>
    );
  }

  // Sale listings only: a monthly rent is not comparable with a sale price, and this page
  // publishes one price context figure, so it stays a sale figure until rentals have their own.
  const localListings = (properties.data ?? []).filter((p) => p.location === locality.name && transactionTypeOf(p) === "buy");
  const price = priceContext(localListings, "buy");
  const point = (locality.latitude != null && locality.longitude != null)
    ? { lat: Number(locality.latitude), lng: Number(locality.longitude) }
    : areaPoint(locality.city, locality.name);
  const projects = infra.data ?? [];
  const checkedAt = intel.data?.fetched_at ? new Date(intel.data.fetched_at).toLocaleDateString("en-IN") : null;
  const dataQuality: Evidence = intel.data ? "ESTIMATE" : "UNKNOWN";

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-sm text-muted-foreground">
        <Link to="/location-intelligence" className="underline">Localities</Link> · {locality.city} · {locality.corridor} · tier {locality.tier}
      </p>
      <h1 className="mt-1 text-4xl">{locality.name}</h1>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        Data quality: <EvidenceBadge evidence={dataQuality} />
        {checkedAt ? `Area data checked ${checkedAt}.` : "No area data published for this locality yet."}
      </p>
      <Button asChild variant="outline" size="sm" className="mt-3">
        <Link to="/location-intelligence/compare" search={{ a: locality.slug, b: "" }} data-testid="compare-with-another-locality-button">
          Compare with another locality
        </Link>
      </Button>

      <div className="mt-6 flex gap-2">
        {(["snapshot", "map", "sources"] as const).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)}>
            {t === "snapshot" ? "Snapshot" : t === "map" ? "Neighbourhood map" : "Sources"}
          </Button>
        ))}
      </div>

      {tab === "snapshot" && (
        <div className="mt-6 space-y-8">
          <section>
            <h2 className="text-2xl">What is around it</h2>
            {intel.isLoading ? (
              <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
            ) : intel.data ? (
              <div className="mt-3"><AreaIntelCard s={intel.data.summary as unknown as AreaSummary} fetchedAt={intel.data.fetched_at} /></div>
            ) : (
              <div className="mt-3"><Unknown>No published area snapshot for {locality.name}. We have not checked the open map data for this locality, so nothing is shown.</Unknown></div>
            )}
          </section>

          <section>
            <h2 className="text-2xl">Flood and drainage</h2>
            {intel.isLoading ? (
              <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
            ) : (
              <div className="mt-3">
                <FloodPanel area={locality.name} brief={floodBrief(floodInputFromSummary(intel.data ? (intel.data.summary as unknown as AreaSummary) : null))} />
              </div>
            )}
          </section>

          <section>
            <h2 className="text-2xl">Infrastructure</h2>
            <p className="mt-1 text-sm text-muted-foreground">Every project keeps its source and the date we last checked it. We do not predict price effects.</p>
            {infra.isLoading ? (
              <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
            ) : projects.length === 0 ? (
              <div className="mt-3"><Unknown>No published infrastructure project is recorded for {locality.name}.</Unknown></div>
            ) : (
              <div className="mt-3 space-y-3">
                {projects.map((x) => (
                  <div key={x.id} className="rounded-xl border bg-card p-4 shadow-card">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-lg">{x.name}</h3>
                      <span className={`rounded-full px-3 py-0.5 text-xs font-medium ${x.verified ? "bg-secondary text-success" : "bg-warning-soft text-warning"}`}>
                        {infraStatusLabel(x.progress_status)} · {x.verified ? "verified" : "unverified"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{x.location}{x.last_checked && ` · last checked ${x.last_checked}`}</p>
                    {x.description && <p className="mt-1 text-sm">{x.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-2xl">Price context</h2>
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <EvidenceBadge evidence={price.evidence} />
              {price.medianPpsf != null
                ? <>Median asking price {formatINR(price.medianPpsf)}/sq ft · range {formatINR(price.rangePpsf?.low)}–{formatINR(price.rangePpsf?.high)}</>
                : "No price figure to show"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{price.reason}</p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link to="/properties" search={{ locality: locality.name }}>See homes in {locality.name}</Link>
            </Button>
          </section>

          <section>
            <h2 className="text-2xl">Risks and open questions</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>We have not run a flood, drainage or legal check for {locality.name}. Open map data is not a substitute.</li>
              <li>Asking prices are claims by sellers. PropWise holds no confirmed sale prices, so nothing here is a market valuation.</li>
              <li>Infrastructure dates come from the source listed. A project can slip without the source updating.</li>
            </ul>
          </section>
        </div>
      )}

      {tab === "map" && (
        <div className="mt-6">
          <h2 className="text-2xl">Neighbourhood map</h2>
          <p className="mt-1 text-sm text-muted-foreground">Places within 2 km, from OpenStreetMap. If the lookup fails we say unknown rather than show an empty map.</p>
          <div className="mt-3">
            {point ? (
              <LocalityMap name={locality.name} lat={point.lat} lng={point.lng} />
            ) : (
              <Unknown>No coordinates recorded for {locality.name}, so we cannot draw a map.</Unknown>
            )}
          </div>
        </div>
      )}

      {tab === "sources" && (
        <div className="mt-6 space-y-4 text-sm">
          <h2 className="text-2xl">Sources</h2>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Area snapshot: OpenStreetMap contributors and Open-Meteo elevation{checkedAt ? `, checked ${checkedAt}` : ""}.</li>
            <li>Infrastructure: the source link on each project above, when one is recorded.</li>
            <li>Price context: asking prices on published PropWise listings in {locality.name}. Sellers state these; we do not verify them.</li>
          </ul>
          {projects.filter((p) => p.source_url).map((p) => (
            <p key={p.id} className="flex items-center gap-1">
              <a href={p.source_url as string} target="_blank" rel="noreferrer" className="text-primary hover:underline">{p.name}</a>
              <ExternalLink className="size-3.5" />
            </p>
          ))}
          <p className="text-muted-foreground">Rates used for cost estimates come from PropWise settings{rulesNote(settings?.stamp_duty_pct, settings?.registration_pct)}.</p>
        </div>
      )}
    </div>
  );
}

function rulesNote(stamp?: string, registration?: string): string {
  if (!stamp && !registration) return ", which the owner maintains";
  return ` (stamp duty ${stamp ?? "unknown"}%, registration ${registration ?? "unknown"}%)`;
}
