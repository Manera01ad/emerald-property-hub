import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { groupByArea, infraStatusLabel } from "@/lib/infrastructure";

export const Route = createFileRoute("/infrastructure")({
  staticData: { sitemap: true },
  head: () => ({
    links: [{ rel: "canonical", href: "https://emerald-property-hub.lovable.app/infrastructure" }],
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://emerald-property-hub.lovable.app/infrastructure" },
      { title: "Chennai Infrastructure Projects — PropWise AI" },
      { name: "description", content: "Infrastructure projects near Chennai's growth corridors, with sources and verified progress status." },
      { property: "og:title", content: "Chennai Infrastructure Projects — PropWise AI" },
      { property: "og:description", content: "Sourced infrastructure updates for Chennai suburbs." },
    ],
  }),
  component: InfraPage,
});

function InfraPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["infra"],
    // Public reads are limited by the "public read infra" policy to published
    // rows, so the query does not need its own visibility filter.
    queryFn: async () => (await supabase.from("infrastructure_projects").select("*").order("name")).data ?? [],
  });
  const groups = groupByArea(data);
  return (
    <div className="mx-auto max-w-5xl px-4 py-14">
      <h1 className="text-4xl">Infrastructure</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">What is planned, under construction, or already open near each area. Every project is listed with its source and the date we last checked it. Progress is marked verified only when our team has confirmed it. We don't predict price appreciation.</p>
      <div className="mt-8 space-y-10">
        {isLoading ? <p className="text-muted-foreground">Loading…</p> : groups.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">Sourced infrastructure updates will appear here soon.</div>
        ) : groups.map((g) => (
          <section key={g.area}>
            <h2 className="text-2xl">{g.area}</h2>
            <div className="mt-4 space-y-4">
              {g.projects.map((x) => (
                <div key={x.id} className="rounded-xl border bg-card p-5 shadow-card">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xl">{x.name}</h3>
                    <span className={`rounded-full px-3 py-0.5 text-xs font-medium ${x.verified ? "bg-secondary text-success" : "bg-warning-soft text-warning"}`}>
                      {infraStatusLabel(x.progress_status)} · {x.verified ? "verified" : "unverified"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{x.location}{x.last_checked && ` · last checked ${x.last_checked}`}</p>
                  {x.description && <p className="mt-2 text-sm">{x.description}</p>}
                  {x.source_url && <a href={x.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline">Source <ExternalLink className="size-3.5" /></a>}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
