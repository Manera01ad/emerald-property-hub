import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EvidenceBadge } from "@/components/EvidenceBadge";
import { useLocalities } from "@/lib/data";
import { rankLocality, rankingInputsFor, type RankingRows } from "@/lib/ranking";
import { Panel } from "./shared";

/**
 * Locality ranking, admin only (Phase 1 W3-3). It reads evidence counts we already hold and
 * says UNKNOWN where a component is below its floor. No figure here is shown to buyers and
 * nothing is written back to the database.
 */
export function Ranking() {
  const localities = useLocalities();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin", "ranking-rows"],
    queryFn: async (): Promise<RankingRows> => {
      const [properties, interests, projects, snapshots] = await Promise.all([
        supabase.from("properties").select("id,location,asking_price,built_area_sqft,land_area_sqft").eq("status", "published").eq("is_demo", false).eq("listing_permission", true),
        supabase.from("enquiries").select("property_id").eq("enquiry_type", "interest"),
        supabase.from("infrastructure_projects").select("location,verified").eq("is_published", true),
        supabase.from("area_intelligence").select("area").eq("is_published", true),
      ]);
      const failure = properties.error ?? interests.error ?? projects.error ?? snapshots.error;
      if (failure) throw failure;
      return {
        properties: properties.data ?? [],
        interestPropertyIds: (interests.data ?? []).flatMap((r) => (r.property_id ? [r.property_id] : [])),
        projects: projects.data ?? [],
        snapshotAreas: (snapshots.data ?? []).map((r) => r.area),
      };
    },
  });

  const rows = useMemo(() => {
    if (!data) return [];
    return (localities.data ?? []).map((l) => rankLocality(rankingInputsFor(l.name, data)));
  }, [data, localities.data]);

  return (
    <Panel>
      <h2 className="text-xl">Locality ranking</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        A reading of the evidence we hold, not a market forecast. D is recorded interest, S is published listings, P is price comparables,
        I is infrastructure with confirmed progress. A component below its evidence floor shows UNKNOWN, because "not enough evidence" is not
        the same as "low". This panel is admin only.
      </p>

      {isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      ) : isError ? (
        <p className="mt-4 text-sm text-destructive">Couldn't load ranking rows: {(error as Error).message}</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No localities are set up yet.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {rows.map((r) => (
            <div key={r.locality} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium">{r.locality}</h3>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  Data quality <EvidenceBadge evidence={r.quality.evidence} />
                  {r.risk.flagged && <span className="rounded-full bg-warning-soft px-2 py-0.5 font-medium text-warning">Risk flag</span>}
                </span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {r.components.map((c) => (
                  <div key={c.key} className="rounded-md border bg-muted/30 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.key}</p>
                    <p className="mt-1 font-display text-2xl">{c.score ?? "—"}</p>
                    <p className="text-xs font-medium">{c.label}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><EvidenceBadge evidence={c.evidence} /></p>
                    <p className="mt-1 text-xs text-muted-foreground">{c.note}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{r.quality.note}</p>
              {r.risk.flagged && (
                <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                  {r.risk.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
