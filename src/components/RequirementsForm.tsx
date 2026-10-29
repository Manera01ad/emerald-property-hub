import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROPERTY_TYPES } from "@/lib/constants";
import { useLocalities } from "@/lib/data";
import { useSession } from "@/lib/auth";

export type Requirements = {
  budgetLakh?: number | undefined;
  location?: string | undefined;
  type?: string | undefined;
  bedrooms?: number | undefined;
  minArea?: number | undefined;
  verifiedOnly?: boolean | undefined;
};

const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

/**
 * Buyer requirements, at the top of the results. Anonymous visitors keep everything in the
 * address bar so a search can be shared. Signed-in visitors can save the same answers to
 * their own profile; nothing is written anywhere else.
 */
export function RequirementsForm({ value, onChange }: { value: Requirements; onChange: (patch: Requirements) => void }) {
  const { session } = useSession();
  const { data: localities = [] } = useLocalities();
  const [saving, setSaving] = useState(false);

  async function save() {
    const uid = session?.user.id;
    if (!uid) return;
    setSaving(true);
    const { error } = await supabase.from("buyer_profiles").upsert(
      {
        user_id: uid,
        intent: "buy",
        property_types: value.type ? [value.type] : [],
        budget: value.budgetLakh ? value.budgetLakh * 1e5 : null,
        preferred_locations: value.location ? [value.location] : [],
        bedrooms: value.bedrooms ?? null,
        min_area_sqft: value.minArea ?? null,
      },
      { onConflict: "user_id" },
    );
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved to your profile");
  }

  const num = (v: string) => (v ? Number(v) : undefined);

  return (
    <section className="rounded-xl border bg-card p-4 shadow-card md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Tell us what you need</h2>
        <p className="text-xs text-muted-foreground">
          {session ? "Saved to your profile when you press save." : <><Link to="/auth" className="underline">Sign in</Link> to save these requirements.</>}
        </p>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <div className="space-y-1.5">
          <Label htmlFor="req-budget">Budget (₹ lakhs)</Label>
          <Input id="req-budget" type="number" min={0} defaultValue={value.budgetLakh} placeholder="e.g. 60" onBlur={(e) => onChange({ budgetLakh: num(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="req-locality">Locality</Label>
          <select id="req-locality" className={sel} value={value.location ?? ""} onChange={(e) => onChange({ location: e.target.value || undefined })}>
            <option value="">Any locality</option>
            {localities.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="req-type">Type</Label>
          <select id="req-type" className={sel} value={value.type ?? ""} onChange={(e) => onChange({ type: e.target.value || undefined })}>
            <option value="">Any type</option>
            {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="req-bedrooms">Min bedrooms</Label>
          <Input id="req-bedrooms" type="number" min={0} defaultValue={value.bedrooms} onBlur={(e) => onChange({ bedrooms: num(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="req-area">Min area (sq ft)</Label>
          <Input id="req-area" type="number" min={0} defaultValue={value.minArea} onBlur={(e) => onChange({ minArea: num(e.target.value) })} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={!!value.verifiedOnly} onCheckedChange={(v) => onChange({ verifiedOnly: v === true || undefined })} />
          Only listings whose documents we have verified
        </label>
        {session && <Button size="sm" variant="outline" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save to my profile"}</Button>}
      </div>
    </section>
  );
}
