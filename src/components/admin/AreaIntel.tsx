import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AREAS } from "@/lib/areas";
import { refreshAreaIntelligence } from "@/lib/area-intel.functions";
import type { AreaSummary } from "@/lib/area-intel";
import { AreaIntelCard } from "@/components/AreaIntelCard";
import { OfficialFloodEditor } from "./OfficialFlood";
import { Panel, useAdminTable, useInvalidateAdmin } from "./shared";

export function AreaIntel() {
  const { data: rows = [] } = useAdminTable("area_intelligence", "area");
  const invalidate = useInvalidateAdmin();
  const [busy, setBusy] = useState<string | null>(null);
  const [batch, setBatch] = useState(false);
  const [progress, setProgress] = useState("");
  const fetchArea = useServerFn(refreshAreaIntelligence);
  const [open, setOpen] = useState<string | null>(null);
  const list = Object.entries(AREAS).flatMap(([city, areas]) => Object.keys(areas).map((area) => ({ city, area })));

  const refresh = async (city: string, area: string) => {
    setBusy(area);
    try {
      const r = await fetchArea({ data: { city, area } });
      toast.success(`${area}: ${r.elements} map features saved`);
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
    setBatch(true);
    let saved = 0;
    let failed = 0;
    try {
      const { data: existing, error } = await supabase.from("area_intelligence").select("city,area");
      if (error) throw error;
      const missing = list.filter(({ city, area }) => !existing?.some((r) => r.city === city && r.area === area));
      for (const [index, { city, area }] of missing.entries()) {
        setProgress(`${index + 1} of ${missing.length}: ${area} · ${saved} saved · ${failed} failed`);
        if (await refresh(city, area)) saved++; else failed++;
        if (index < missing.length - 1) await new Promise((res) => setTimeout(res, 3000));
      }
      setProgress(`${saved} saved · ${failed} failed. New areas stay hidden until published.`);
    } catch {
      toast.error("Couldn't load the area list. Try again.");
    } finally {
      setBatch(false);
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
        <Button size="sm" onClick={refreshMissing} disabled={!!busy || batch}>{batch ? "Fetching missing areas…" : "Fetch all missing areas"}</Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground" role="status">{rows.length} of {list.length} areas fetched · {rows.filter((r) => r.is_published).length} public{progress ? ` · ${progress}` : ""}</p>
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
                  {r && <Button size="sm" variant="outline" disabled={!!busy || batch} onClick={() => setPublished(r.id, !r.is_published)}>{r.is_published ? "Unpublish" : "Publish"}</Button>}
                  <Button size="sm" variant="outline" disabled={!!busy || batch} onClick={() => refresh(city, area)}>{busy === area ? "Fetching…" : r ? "Refresh" : "Fetch"}</Button>
                </div>
              </div>
              {r && open === area && (
                <div className="mt-3">
                  <AreaIntelCard s={r.summary as unknown as AreaSummary} fetchedAt={r.fetched_at} />
                  <OfficialFloodEditor id={r.id} area={area} summary={r.summary} published={r.is_published} onSaved={() => invalidate("area_intelligence")} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
