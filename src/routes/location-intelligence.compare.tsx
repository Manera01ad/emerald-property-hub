import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EvidenceBadge } from "@/components/EvidenceBadge";
import { localitiesQuery, publicPropertiesQuery } from "@/lib/data";
import { transactionTypeOf } from "@/lib/transaction";
import type { AreaSummary } from "@/lib/area-intel";
import { COMPARE_GROUPS, compareLocalities } from "@/lib/locality-compare";

type Search = { a: string; b: string };

export const Route = createFileRoute("/location-intelligence/compare")({
  staticData: { sitemap: false },
  validateSearch: (s: Record<string, unknown>): Search => ({
    a: typeof s["a"] === "string" ? s["a"] : "",
    b: typeof s["b"] === "string" ? s["b"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Compare localities — PropWise AI" },
      { name: "description", content: "Compare two Chennai localities side by side on flood facts, transport and asking prices. Every figure shows its evidence label; missing data reads unknown." },
    ],
  }),
  component: ComparePage,
});

/** Published rows only, through the table's public-read policy. */
const publishedAreasQuery = {
  queryKey: ["area-intelligence", "published"],
  queryFn: async () => {
    const { data, error } = await supabase.from("area_intelligence").select("area, summary").eq("is_published", true);
    if (error) throw error;
    return data ?? [];
  },
};

function ComparePage() {
  const { a, b } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const localities = useQuery(localitiesQuery);
  const areas = useQuery(publishedAreasQuery);
  const properties = useQuery(publicPropertiesQuery);
  const all = localities.data ?? [];
  const chosen = [a, b].map((slug) => all.find((l) => l.slug === slug) ?? null);
  const ready = chosen.every((l) => l !== null) && a !== b;

  const columns = ready
    ? chosen.map((l) => {
        const row = (areas.data ?? []).find((r) => r.area.toLowerCase() === l!.name.toLowerCase());
        return {
          name: l!.name,
          summary: row ? (row.summary as unknown as AreaSummary) : null,
          listings: (properties.data ?? []).filter((p) => p.location === l!.name && transactionTypeOf(p) === "buy"),
        };
      })
    : [];
  const rows = compareLocalities(columns);

  const picker = (key: "a" | "b", value: string, label: string) => (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <select
        className="rounded-md border bg-background px-3 py-2"
        value={value}
        data-testid={`compare-locality-${key}-select`}
        onChange={(e) => navigate({ search: (prev) => ({ ...prev, [key]: e.target.value }) })}
      >
        <option value="">Choose a locality</option>
        {all.map((l) => <option key={l.slug} value={l.slug}>{l.name}</option>)}
      </select>
    </label>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-sm text-muted-foreground"><Link to="/location-intelligence" className="underline">Localities</Link> · Compare</p>
      <h1 className="mt-1 text-4xl">Compare two localities</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Flood facts, transport and asking prices side by side. Each figure shows the evidence behind it. Unknown means we hold no evidence — not that there is no problem.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {picker("a", a, "First locality")}
        {picker("b", b, "Second locality")}
      </div>

      {!ready ? (
        <p className="mt-8 text-sm text-muted-foreground" data-testid="compare-empty-state">
          {a && a === b ? "Choose two different localities." : "Choose two localities to compare."}
        </p>
      ) : areas.isLoading || properties.isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm" data-testid="compare-table">
            <thead>
              <tr>
                <th className="w-1/4 border-b p-2 text-left" />
                {columns.map((c, i) => (
                  <th key={c.name} className="border-b p-2 text-left text-lg font-semibold">
                    <Link to="/location-intelligence/$area" params={{ area: chosen[i]!.slug }} className="hover:underline">{c.name}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_GROUPS.map((g) => (
                <Fragment key={g}>
                  <tr><th colSpan={columns.length + 1} className="bg-secondary p-2 text-left font-semibold">{g}</th></tr>
                  {rows.filter((r) => r.group === g).map((r) => (
                    <tr key={r.key} className="align-top" data-testid={`compare-row-${r.key}`}>
                      <th scope="row" className="border-b p-2 text-left font-medium">{r.label}</th>
                      {r.cells.map((c, i) => (
                        <td key={i} className="border-b p-2">
                          <div className="flex flex-wrap items-center gap-2"><span>{c.value}</span><EvidenceBadge evidence={c.evidence} /></div>
                          {c.note && <p className="mt-0.5 text-xs text-muted-foreground">{c.note}</p>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-muted-foreground">
            Open data from OpenStreetMap and Open-Meteo around each locality's centre, not a specific plot. Asking prices are sellers' claims, not confirmed sale prices. This is not a flood assessment or a valuation.
          </p>
        </div>
      )}
    </div>
  );
}
