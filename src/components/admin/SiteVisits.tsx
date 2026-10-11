import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { humanize } from "@/lib/constants";
import { Panel, selectCls, useAdminTable, useInvalidateAdmin } from "./shared";

export const VISIT_STATUSES = ["scheduled", "completed", "cancelled", "no_show"];

export function SiteVisits() {
  const { data = [] } = useAdminTable("site_visits", "visit_at");
  const { data: enq = [] } = useAdminTable("enquiries");
  const { data: props = [] } = useAdminTable("properties");
  const inv = useInvalidateAdmin();

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const when = String(f.get("when") || "");
    if (!when) return void toast.error("Choose a date and time");
    const enquiry_id = String(f.get("enquiry") || "") || null;
    const { error } = await supabase.from("site_visits").insert({
      enquiry_id,
      property_id: String(f.get("property") || "") || null,
      visit_at: new Date(when).toISOString(),
      notes: String(f.get("notes") || "") || null,
    });
    if (error) return void toast.error(error.message);
    if (enquiry_id) {
      const cur = enq.find((x) => x.id === enquiry_id);
      if (!cur || ["new", "contacted", "qualified"].includes(cur.status)) {
        const { error: stageErr } = await supabase.from("enquiries").update({ status: "site_visit" }).eq("id", enquiry_id).in("status", ["new", "contacted", "qualified"]);
        if (stageErr) toast.error("Visit saved, but the buyer's stage could not be updated: " + stageErr.message);
      }
      inv("enquiries");
    }
    form.reset();
    inv("site_visits");
    toast.success("Visit scheduled");
  }

  async function update(id: string, patch: { status?: string; notes?: string | null }) {
    const { error } = await supabase.from("site_visits").update(patch).eq("id", id);
    if (error) return void toast.error(error.message);
    inv("site_visits");
  }

  return (
    <Panel>
      <p className="mb-2 font-medium">Schedule a site visit</p>
      <form onSubmit={add} className="grid gap-2 md:grid-cols-5">
        <select name="enquiry" className={selectCls}><option value="">Buyer…</option>{enq.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.phone})</option>)}</select>
        <select name="property" className={selectCls}><option value="">Property…</option>{props.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
        <Input name="when" type="datetime-local" required />
        <Input name="notes" placeholder="Notes" />
        <Button type="submit">Add visit</Button>
      </form>
      <div className="mt-6 space-y-2">
        {data.length === 0 && <p className="text-sm text-muted-foreground">No site visits recorded yet.</p>}
        {data.map((v) => (
          <div key={v.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
            <div className="min-w-48 flex-1">
              <p className="font-medium">{new Date(v.visit_at).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{enq.find((x) => x.id === v.enquiry_id)?.name ?? "No buyer"} · {props.find((p) => p.id === v.property_id)?.title ?? "No property"}</p>
            </div>
            <Input className="h-8 max-w-64" defaultValue={v.notes ?? ""} placeholder="Notes" onBlur={(e) => e.target.value !== (v.notes ?? "") && update(v.id, { notes: e.target.value || null })} />
            <select className={selectCls + " h-8 w-36"} value={v.status} onChange={(e) => update(v.id, { status: e.target.value })}>{VISIT_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}</select>
            <Button size="icon" variant="ghost" onClick={async () => { if (confirm("Delete visit?")) { await supabase.from("site_visits").delete().eq("id", v.id); inv("site_visits"); } }}><Trash2 /></Button>
          </div>
        ))}
      </div>
    </Panel>
  );
}
