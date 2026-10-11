import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { humanize } from "@/lib/constants";
import { Panel, selectCls, useAdminTable, useInvalidateAdmin } from "./shared";

export function Partners() {
  const { data = [] } = useAdminTable("partners");
  const inv = useInvalidateAdmin();

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const { error } = await supabase.from("partners").insert({
      name: String(f.get("name")),
      kind: String(f.get("kind")),
      phone: String(f.get("phone") || "") || null,
      email: String(f.get("email") || "") || null,
      rera_number: String(f.get("rera") || "") || null,
      notes: String(f.get("notes") || "") || null,
    });
    if (error) { toast.error(error.message); return; }
    form.reset();
    inv("partners");
  }
  async function del(id: string) {
    if (!confirm("Delete this partner?")) return;
    await supabase.from("partners").delete().eq("id", id);
    inv("partners");
  }

  return (
    <Panel>
      <form onSubmit={add} className="grid gap-2 md:grid-cols-7">
        <Input name="name" placeholder="Name *" required className="md:col-span-2" />
        <select name="kind" className={selectCls}><option value="developer">Developer</option><option value="agent">Agent</option><option value="owner">Owner</option></select>
        <Input name="phone" placeholder="Phone" />
        <Input name="email" placeholder="Email" type="email" />
        <Input name="rera" placeholder="RERA no." />
        <Button type="submit">Add</Button>
        <Input name="notes" placeholder="Notes" className="md:col-span-7" />
      </form>
      <table className="mt-6 w-full text-sm">
        <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Name</th><th>Type</th><th>Contact</th><th>RERA</th><th>Agreement</th><th /></tr></thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.id} className="border-b last:border-0">
              <td className="py-2 font-medium">{p.name}<div className="text-xs font-normal text-muted-foreground">{p.notes}</div></td>
              <td>{humanize(p.kind)}</td><td>{[p.phone, p.email].filter(Boolean).join(" · ")}</td><td>{p.rera_number}</td>
              <td><select className={selectCls + " h-8 w-36"} value={p.agreement_status} onChange={async (e) => { const { error } = await supabase.from("partners").update({ agreement_status: e.target.value }).eq("id", p.id); if (error) toast.error(error.message); inv("partners"); }}>{["none", "in_discussion", "signed", "expired"].map((s) => <option key={s} value={s}>{humanize(s)}</option>)}</select></td>
              <td className="text-right"><Button size="icon" variant="ghost" onClick={() => del(p.id)}><Trash2 /></Button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.length === 0 && <p className="mt-4 text-sm text-muted-foreground">No partners yet.</p>}
    </Panel>
  );
}
