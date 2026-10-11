import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MARKETS, humanize } from "@/lib/constants";
import { Panel, selectCls, useAdminTable, useInvalidateAdmin } from "./shared";

const STATUSES = ["announced", "approved", "under_construction", "completed", "stalled"];

export function Infrastructure() {
  const { data = [] } = useAdminTable("infrastructure_projects");
  const inv = useInvalidateAdmin();
  const up = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("infrastructure_projects").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    inv("infrastructure_projects");
  };

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const { error } = await supabase.from("infrastructure_projects").insert({
      name: String(f.get("name")),
      location: String(f.get("location")),
      description: String(f.get("description") || "") || null,
      progress_status: String(f.get("status")),
      source_url: String(f.get("source") || "") || null,
      last_checked: new Date().toISOString().slice(0, 10),
    });
    if (error) return toast.error(error.message);
    form.reset();
    inv("infrastructure_projects");
  }

  return (
    <Panel>
      <form onSubmit={add} className="grid gap-2 md:grid-cols-6">
        <Input name="name" placeholder="Project name *" required className="md:col-span-2" />
        <select name="location" className={selectCls}>{MARKETS.map((m) => <option key={m}>{m}</option>)}</select>
        <select name="status" className={selectCls}>{STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}</select>
        <Input name="source" placeholder="Source URL" type="url" />
        <Button type="submit">Add</Button>
        <Input name="description" placeholder="Short description" className="md:col-span-6" />
      </form>
      <p className="mt-2 text-xs text-muted-foreground">New projects start unpublished and unverified. Mark verified only after confirming with an official source.</p>
      <div className="mt-4 space-y-2">
        {data.map((x) => (
          <div key={x.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
            <div><p className="font-medium">{x.name}</p><p className="text-xs text-muted-foreground">{x.location} · {humanize(x.progress_status)} {x.source_url ? "· sourced" : "· no source"}</p></div>
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
