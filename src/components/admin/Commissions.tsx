import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { humanize } from "@/lib/constants";
import { formatINRFull } from "@/lib/format";
import { Panel, selectCls, useAdminTable, useInvalidateAdmin } from "./shared";

const STATUSES = ["agreed", "invoiced", "partially_paid", "paid", "cancelled"];

export function Commissions() {
  const { data = [] } = useAdminTable("commissions");
  const { data: partners = [] } = useAdminTable("partners");
  const { data: props = [] } = useAdminTable("properties");
  const inv = useInvalidateAdmin();
  const s = (f: FormData, k: string) => String(f.get(k) || "") || null;

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const { error } = await supabase.from("commissions").insert({
      partner_id: s(f, "partner"),
      property_id: s(f, "property"),
      agreement_terms: s(f, "terms"),
      commission_pct: f.get("pct") ? Number(f.get("pct")) : null,
      expected_amount: Number(f.get("expected") || 0),
    });
    if (error) return void toast.error(error.message);
    form.reset();
    inv("commissions");
  }
  async function update(id: string, patch: Record<string, unknown>) {
    const { error } = await supabase.from("commissions").update(patch).eq("id", id);
    if (error) return void toast.error(error.message);
    inv("commissions");
  }

  return (
    <Panel>
      <p className="mb-2 font-medium">Record a commission agreement</p>
      <form onSubmit={add} className="grid gap-2 md:grid-cols-6">
        <select name="partner" className={selectCls}><option value="">Partner…</option>{partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select name="property" className={selectCls}><option value="">Property…</option>{props.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
        <Input name="pct" type="number" step="0.01" placeholder="Commission %" />
        <Input name="expected" type="number" placeholder="Expected ₹ *" required />
        <Input name="terms" placeholder="Agreement terms" />
        <Button type="submit">Add</Button>
      </form>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Partner / Property</th><th>Expected</th><th>Invoice #</th><th>Invoice date</th><th>Paid ₹</th><th>Paid date</th><th>Status</th><th /></tr></thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="py-2">
                  <div className="font-medium">{partners.find((p) => p.id === c.partner_id)?.name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{props.find((p) => p.id === c.property_id)?.title} {c.commission_pct && `· ${c.commission_pct}%`} {c.agreement_terms && `· ${c.agreement_terms}`}</div>
                </td>
                <td>{formatINRFull(c.expected_amount)}</td>
                <td><Input className="h-8 w-28" defaultValue={c.invoice_number ?? ""} onBlur={(e) => e.target.value !== (c.invoice_number ?? "") && update(c.id, { invoice_number: e.target.value || null })} /></td>
                <td><Input className="h-8 w-36" type="date" defaultValue={c.invoice_date ?? ""} onBlur={(e) => update(c.id, { invoice_date: e.target.value || null })} /></td>
                <td><Input className="h-8 w-28" type="number" defaultValue={c.paid_amount} onBlur={(e) => Number(e.target.value) !== Number(c.paid_amount) && update(c.id, { paid_amount: Number(e.target.value || 0) })} /></td>
                <td><Input className="h-8 w-36" type="date" defaultValue={c.paid_date ?? ""} onBlur={(e) => update(c.id, { paid_date: e.target.value || null })} /></td>
                <td><select className={selectCls + " h-8 w-36"} value={c.status} onChange={(e) => update(c.id, { status: e.target.value })}>{STATUSES.map((x) => <option key={x} value={x}>{humanize(x)}</option>)}</select></td>
                <td><Button size="icon" variant="ghost" onClick={async () => { if (confirm("Delete?")) { await supabase.from("commissions").delete().eq("id", c.id); inv("commissions"); } }}><Trash2 /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && <p className="mt-4 text-sm text-muted-foreground">No commissions recorded yet.</p>}
      </div>
    </Panel>
  );
}
