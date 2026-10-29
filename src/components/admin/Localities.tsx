import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAllLocalities } from "@/lib/data";
import { updateLocality } from "@/lib/localities-data";
import { TIER_LABELS, isLocalityTier } from "@/lib/localities";
import { Panel, selectCls } from "./shared";

/** Tier decides the order of study and rollout, not quality. Hidden rows stay out of public lists. */
export function Localities() {
  const { data = [], isLoading } = useAllLocalities();
  const qc = useQueryClient();

  async function update(id: string, patch: { tier?: number; status?: "hidden" | "active" }) {
    try {
      await updateLocality(id, patch);
      qc.invalidateQueries({ queryKey: ["localities"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Panel>
      <h2 className="text-xl">Localities</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The controlled list every new form selects from. Only active rows are visible to buyers. Tiers order the study and rollout.
      </p>
      {isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      ) : data.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No localities found. Run the localities migration to seed the Chennai pilot list.</p>
      ) : (
        <div className="mt-4 divide-y">
          {data.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-52">
                <p className="font-medium">{l.name}</p>
                <p className="text-xs text-muted-foreground">{l.city} · {l.corridor} · /{l.slug}</p>
              </div>
              <select
                className={`${selectCls} w-56`}
                value={l.tier}
                onChange={(e) => update(l.id, { tier: Number(e.target.value) })}
                aria-label={`Tier for ${l.name}`}
              >
                {[1, 2, 3].map((t) => (
                  <option key={t} value={t} disabled={!isLocalityTier(t)}>{TIER_LABELS[t as 1 | 2 | 3]}</option>
                ))}
              </select>
              <Button size="sm" variant="outline" onClick={() => update(l.id, { status: l.status === "active" ? "hidden" : "active" })}>
                {l.status === "active" ? "Hide from public" : "Make public"}
              </Button>
              <span className="text-xs text-muted-foreground">{l.status === "active" ? "Public" : "Hidden"}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
