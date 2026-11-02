import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readOfficialFlood, validateOfficialFlood } from "@/lib/flood";

/**
 * Admin form to file (or remove) an official flood-zone record for one area. The
 * record is stored in the area's summary under `official_flood`, and is shown to
 * the public with an Official source badge only while the area is published.
 */
export function OfficialFloodEditor({ id, area, summary, published, onSaved }: {
  id: string;
  area: string;
  summary: unknown;
  published: boolean;
  onSaved: () => void;
}) {
  const current = readOfficialFlood(summary);
  const [draft, setDraft] = useState({ label: "", source: "", source_url: "", observed_on: "" });
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const base = summary && typeof summary === "object" ? (summary as Record<string, unknown>) : {};

  const write = async (next: Record<string, unknown>, done: string) => {
    setSaving(true);
    const { error } = await supabase.from("area_intelligence").update({ summary: next as unknown as Json }).eq("id", id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(done);
    onSaved();
  };

  const save = async () => {
    const r = validateOfficialFlood(draft);
    if (!r.ok) { setErrors(r.errors); return; }
    setErrors([]);
    await write({ ...base, official_flood: r.record }, `${area}: official flood record saved`);
    setDraft({ label: "", source: "", source_url: "", observed_on: "" });
  };

  const remove = async () => {
    const { official_flood: _removed, ...rest } = base;
    await write(rest, `${area}: official flood record removed`);
  };

  const field = (key: keyof typeof draft, label: string, placeholder: string, type = "text") => (
    <div className="space-y-1">
      <Label htmlFor={`of-${key}-${id}`} className="text-xs">{label}</Label>
      <Input id={`of-${key}-${id}`} type={type} value={draft[key]} placeholder={placeholder}
        data-testid={`official-flood-${key.replace("_", "-")}-input`}
        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} />
    </div>
  );

  return (
    <div className="mt-3 rounded-lg border p-3" data-testid="official-flood-editor">
      <p className="text-sm font-semibold">Official flood-zone record</p>
      <p className="text-xs text-muted-foreground">
        Only file what an official publication states, in its own words, with its source and date. Never enter a score or your own judgement.
        {published ? " This area is public, so a saved record shows immediately." : " This area is a hidden draft, so nothing shows until it is published."}
      </p>
      {current ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm" data-testid="official-flood-current">
          <span>{current.label} — {current.source}, dated {current.observed_on}</span>
          <Button size="sm" variant="outline" disabled={saving} onClick={remove} data-testid="official-flood-remove-button">Remove</Button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">No official record on file.</p>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {field("label", "Label, as the source words it", "e.g. Inundated in Dec 2015 flood map")}
        {field("source", "Official source", "e.g. Greater Chennai Corporation")}
        {field("source_url", "Source link (https, optional)", "https://")}
        {field("observed_on", "Source date", "YYYY-MM-DD", "date")}
      </div>
      {errors.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-xs text-destructive" data-testid="official-flood-errors">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
      )}
      <Button size="sm" className="mt-3" disabled={saving} onClick={save} data-testid="official-flood-save-button">
        {current ? "Replace record" : "Save record"}
      </Button>
    </div>
  );
}
