import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { VerificationBadge, EstimateNote } from "@/components/Badges";
import { useCompare } from "@/lib/compare";
import { costRulesFrom, publicPropertiesQuery, useSettings, type Property } from "@/lib/data";
import { dealScore, missingDocs, pricePerSqft, purchaseCost } from "@/lib/deal";
import { formatINR } from "@/lib/format";
import { AVAILABILITY, typeLabel } from "@/lib/constants";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Compare Properties — PropWise AI" },
      { name: "description", content: "Compare up to four Chennai properties side by side on total cost, area, approvals and documents." },
      { property: "og:title", content: "Compare Properties — PropWise AI" },
      { property: "og:description", content: "Side-by-side property comparison with estimated total purchase cost." },
    ],
  }),
  component: ComparePage,
});

function ComparePage() {
  const { ids, remove, clear } = useCompare();
  const { data: settings } = useSettings();
  const { data: pool = [] } = useQuery(publicPropertiesQuery);
  const { data: props = [] } = useQuery({
    queryKey: ["compare", ids],
    enabled: ids.length > 0,
    queryFn: async () => ((await supabase.from("properties").select("*").in("id", ids)).data ?? []) as Property[],
  });
  const rules = costRulesFrom(settings);

  if (ids.length === 0)
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-4xl">Compare properties</h1>
        <p className="mt-3 text-muted-foreground">Add up to four properties using the “Compare” button on any listing.</p>
        <Button asChild variant="gold" className="mt-6"><Link to="/properties">Browse properties</Link></Button>
      </div>
    );

  const rows: [string, (p: Property) => React.ReactNode][] = [
    ["Type", (p) => typeLabel(p.property_type)],
    ["Location", (p) => p.location],
    ["Asking price", (p) => formatINR(p.asking_price)],
    ["Est. total cost", (p) => <b className="text-primary">{formatINR(purchaseCost(p, rules).total)}</b>],
    ["Price / sq ft", (p) => formatINR(pricePerSqft(p))],
    ["Bedrooms", (p) => p.bedrooms ?? "—"],
    ["Built-up (sq ft)", (p) => p.built_area_sqft ?? "—"],
    ["Land (sq ft)", (p) => p.land_area_sqft ?? "—"],
    ["Approvals", (p) => p.approvals.join(", ") || "—"],
    ["Availability", (p) => AVAILABILITY[p.availability]],
    ["Verification", (p) => <VerificationBadge status={p.verification_status} />],
    ["Missing documents", (p) => { const m = missingDocs(p); return m.length ? <span className="text-destructive">{m.length} missing</span> : "None"; }],
    ["Deal score", (p) => dealScore(p, pool, []).overall ?? "—"],
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex items-end justify-between">
        <h1 className="text-4xl">Compare</h1>
        <Button variant="ghost" size="sm" onClick={clear}>Clear all</Button>
      </div>
      <div className="mt-6 overflow-x-auto rounded-xl border bg-card shadow-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b">
              <th className="w-40 p-4 text-left font-medium text-muted-foreground" />
              {props.map((p) => (
                <th key={p.id} className="p-4 text-left align-top">
                  <div className="flex items-start justify-between gap-2">
                    <Link to="/properties/$id" params={{ id: p.id }} className="font-display text-base hover:text-primary">{p.title}</Link>
                    <button onClick={() => remove(p.id)} aria-label="Remove"><X className="size-4 text-muted-foreground" /></button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, fn]) => (
              <tr key={label} className="border-b last:border-0 even:bg-muted/40">
                <td className="p-4 font-medium text-muted-foreground">{label}</td>
                {props.map((p) => <td key={p.id} className="p-4">{fn(p)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4"><EstimateNote>Total cost and scores are estimates using configurable Tamil Nadu rules. Location data appears on each property page.</EstimateNote></div>
    </div>
  );
}
