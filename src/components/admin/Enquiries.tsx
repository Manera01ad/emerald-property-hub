import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ENQUIRY_STATUSES, humanize } from "@/lib/constants";
import { formatINR } from "@/lib/format";
import { Panel, selectCls, useAdminTable, useInvalidateAdmin } from "./shared";

export function Enquiries() {
  const { data = [] } = useAdminTable("enquiries");
  const { data: props = [] } = useAdminTable("properties");
  const inv = useInvalidateAdmin();
  const [filter, setFilter] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function update(id: string, patch: Record<string, unknown>) {
    const { error } = await supabase.from("enquiries").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    inv("enquiries");
    toast.success("Saved");
  }

  const rows = data.filter((e) => !filter || e.status === filter);
  return (
    <Panel>
      <div className="mb-4 flex items-center gap-3">
        <select className={selectCls + " max-w-48"} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All statuses</option>
          {ENQUIRY_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </select>
        <span className="text-sm text-muted-foreground">{rows.length} enquiries</span>
      </div>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No enquiries yet.</p> : (
        <div className="space-y-3">
          {rows.map((e) => {
            const prop = props.find((p) => p.id === e.property_id);
            return (
              <div key={e.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{e.name} <span className="text-xs text-muted-foreground">· {humanize(e.enquiry_type)} · {new Date(e.created_at).toLocaleDateString()}</span></p>
                    <p className="text-sm"><a className="text-primary" href={`tel:${e.phone}`}>{e.phone}</a>{e.email && ` · ${e.email}`}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {prop && <>Property: {prop.title} · </>}
                      {e.budget && <>Budget {formatINR(e.budget)} · </>}
                      {e.bedrooms != null && <>{e.bedrooms} BHK · </>}
                      {e.preferred_locations.join(", ")} {e.property_types.map(humanize).join(", ")}
                      {e.preferred_visit_date && <> · Visit {e.preferred_visit_date}</>}
                    </p>
                    {e.message && <p className="mt-1 text-sm">“{e.message}”</p>}
                  </div>
                  <div className="flex gap-2">
                    <select className={selectCls + " w-40"} value={e.status} onChange={(ev) => update(e.id, { status: ev.target.value })}>
                      {ENQUIRY_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
                    </select>
                    <Input type="date" className="w-40" defaultValue={e.next_follow_up ?? ""} onBlur={(ev) => ev.target.value !== (e.next_follow_up ?? "") && update(e.id, { next_follow_up: ev.target.value || null })} title="Next follow-up" />
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Textarea rows={1} placeholder="Internal notes" defaultValue={e.admin_notes ?? ""} onChange={(ev) => setNotes({ ...notes, [e.id]: ev.target.value })} />
                  {notes[e.id] !== undefined && <Button size="sm" onClick={() => update(e.id, { admin_notes: notes[e.id] })}>Save</Button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
