import type { TablesUpdate } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MARKETS, humanize } from "@/lib/constants";
import { areaOptions } from "@/lib/infrastructure";
import { Panel, selectCls, useAdminTable, useInvalidateAdmin } from "./shared";

const STATUSES = ["announced", "approved", "under_construction", "completed", "stalled"];

export function Infrastructure() {
  const { data = [] } = useAdminTable("infrastructure_projects");
  const inv = useInvalidateAdmin();
  const up = async (id: string, patch: TablesUpdate<"infrastructure_projects">) => {
    const { error } = await supabase.from("infrastructure_projects").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    inv("infrastructure_projects");
  };

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    // `area` comes from a pending migration (0009); only send it when chosen so adding still works before it is applied.
    const area = String(f.get("area") || "") || null;
    const { error } = await supabase.from("infrastructure_projects").insert({
      name: String(f.get("name")),
      location: String(f.get("location")),
      ...(area ? ({ area } as Record<string, string>) : {}),
      description: String(f.get("description") || "") || null,
      progress_status: String(f.get("status")),
      source_url: String(f.get("source") || "") || null,
      last_checked: new Date().toISOString().slice(0, 10),
    });
    if (error) return void toast.error(error.message);
    form.reset();
    inv("infrastructure_projects");
  }

  return (
    <Panel>
      <form onSubmit={add} className="grid gap-2 md:grid-cols-7">
        <Input name="name" placeholder="Project name *" required className="md:col-span-2" />
        <select name="location" className={selectCls}>{MARKETS.map((m) => <option key={m}>{m}</option>)}</select>
        <select name="area" className={selectCls} defaultValue="">
          <option value="">Area (optional)</option>
          {areaOptions().map((a) => <option key={a}>{a}</option>)}
        </select>
        <select name="status" className={selectCls}>{STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}</select>
        <Input name="source" placeholder="Source URL" type="url" />
        <Button type="submit">Add</Button>
        <Input name="description" placeholder="Short description" className="md:col-span-7" />
      </form>
      <p className="mt-2 text-xs text-muted-foreground">New projects start unpublished and unverified. Mark verified only after confirming with an official source. Link an area so the project appears under that area on the public page.</p>
      <div className="mt-4 space-y-2">
        {(data as Array<(typeof data)[number] & { area?: string | null }>).map((x) => (
          <div key={x.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
            <div><p className="font-medium">{x.name}</p><p className="text-xs text-muted-foreground">{x.location} · {x.area ? x.area : "no area linked"} · {humanize(x.progress_status)} {x.source_url ? "· sourced" : "· no source"}</p></div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs">Verified <Switch checked={x.verified} onCheckedChange={(v) => up(x.id, { verified: v, last_checked: new Date().toISOString().slice(0, 10) })} /></label>
              <label className="flex items-center gap-2 text-xs">Published <Switch checked={x.is_published} onCheckedChange={(v) => up(x.id, { is_published: v })} /></label>
              <Button size="icon" variant="ghost" onClick={async () => { if (confirm("Delete?")) { await supabase.from("infrastructure_projects").delete().eq("id", x.id); inv("infrastructure_projects"); } }}><Trash2 /></Button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
