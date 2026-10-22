import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AREAS } from "@/lib/areas";
import { refreshAreaIntelligence } from "@/lib/area-intel.functions";
import type { AreaSummary } from "@/lib/area-intel";
import { AreaIntelCard } from "@/components/AreaIntelCard";
import { Panel, useAdminTable, useInvalidateAdmin } from "./shared";

export function AreaIntel() {
  const { data: rows = [] } = useAdminTable("area_intelligence", "area");
  const invalidate = useInvalidateAdmin();
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const list = Object.entries(AREAS).flatMap(([city, areas]) => Object.keys(areas).map((area) => ({ city, area })));

  const refresh = async (city: string, area: string) => {
    setBusy(area);
    try {
      const r = await refreshAreaIntelligence({ data: { city, area } });
      toast.success(`${area}: ${r.elements} map features saved as draft`);
    } catch (e) {
      toast.error(`${area}: ${(e as Error).message}`);
      return false;
    } finally {
      setBusy(null);
      invalidate("area_intelligence");
    }
    return true;
  };

  const refreshMissing = async () => {
    for (const { city, area } of list) {
      if (rows.some((r) => r.area === area)) continue;
      if (!(await refresh(city, area))) break;
      await new Promise((res) => setTimeout(res, 3000));
    }
  };

  const setPublished = async (id: string, v: boolean) => {
    const { error } = await supabase.from("area_intelligence").update({ is_published: v }).eq("id", id);
    if (error) toast.error(error.message);
    invalidate("area_intelligence");
  };

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl">Area intelligence</h2>
          <p className="text-sm text-muted-foreground">Water, parks, transport and height above sea level from free open map data. New data is saved hidden; check it, then publish.</p>
        </div>
        <Button size="sm" onClick={refreshMissing} disabled={!!busy}>Fetch all missing areas</Button>
      </div>
      <div className="mt-4 divide-y">
        {list.map(({ city, area }) => {
          const r = rows.find((x) => x.city === city && x.area === area);
          return (
            <div key={area} className="py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-44 font-medium">{area}</span>
                <span className="text-xs text-muted-foreground">
                  {r ? `${r.is_published ? "Public" : "Hidden draft"} · checked ${new Date(r.fetched_at).toLocaleDateString("en-IN")}` : "Not fetched"}
                </span>
                <div className="ml-auto flex gap-2">
                  {r && <Button size="sm" variant="ghost" onClick={() => setOpen(open === area ? null : area)}>{open === area ? "Hide" : "Review"}</Button>}
                  {r && <Button size="sm" variant="outline" onClick={() => setPublished(r.id, !r.is_published)}>{r.is_published ? "Unpublish" : "Publish"}</Button>}
                  <Button size="sm" variant="outline" disabled={!!busy} onClick={() => refresh(city, area)}>{busy === area ? "Fetching…" : r ? "Refresh" : "Fetch"}</Button>
                </div>
              </div>
              {r && open === area && <div className="mt-3"><AreaIntelCard s={r.summary as unknown as AreaSummary} fetchedAt={r.fetched_at} /></div>}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
