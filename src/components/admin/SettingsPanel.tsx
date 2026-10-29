import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FLAG_KEYS, FLAG_LABELS } from "@/lib/flags";
import { Panel, useAdminTable, useInvalidateAdmin } from "./shared";

export function SettingsPanel() {
  const { data = [] } = useAdminTable("app_settings", "key");
  const inv = useInvalidateAdmin();
  const flags = data.filter((s) => (FLAG_KEYS as readonly string[]).includes(s.key));

  async function setFlag(key: string, on: boolean) {
    const { error } = await supabase
      .from("app_settings")
      .update({ value: on ? "on" : "off", updated_at: new Date().toISOString() })
      .eq("key", key);
    if (error) { toast.error(error.message); return; }
    inv("app_settings");
    toast.success(`${FLAG_LABELS[key as keyof typeof FLAG_LABELS] ?? key} ${on ? "enabled" : "disabled"}`);
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    for (const s of data) {
      const v = String(f.get(s.key) ?? "");
      if (v !== s.value) {
        const { error } = await supabase.from("app_settings").update({ value: v, updated_at: new Date().toISOString() }).eq("key", s.key);
        if (error) { toast.error(error.message); return; }
      }
    }
    inv("app_settings");
    toast.success("Settings saved");
  }

  return (
    <Panel>
      <div className="max-w-2xl space-y-4">
        <h2 className="text-lg font-semibold">Feature flags</h2>
        <p className="text-xs text-muted-foreground">
          New Phase 1 features ship switched off. Turning one on publishes it to everyone immediately, so test it first.
        </p>
        {flags.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No flag rows found. Run the migration that adds feature_community, feature_owner_submissions and feature_interest_requests.
          </p>
        ) : (
          flags.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{FLAG_LABELS[s.key as keyof typeof FLAG_LABELS] ?? s.label ?? s.key}</p>
                <p className="text-xs text-muted-foreground">{s.key} · currently {s.value}</p>
              </div>
              <Button type="button" size="sm" variant={s.value === "on" ? "default" : "outline"} onClick={() => setFlag(s.key, s.value !== "on")}>
                {s.value === "on" ? "Switch off" : "Switch on"}
              </Button>
            </div>
          ))
        )}
      </div>
      <form onSubmit={save} className="mt-8 grid max-w-2xl gap-4">
        {data.filter((s) => !(FLAG_KEYS as readonly string[]).includes(s.key)).map((s) => (
          <div key={s.key} className="space-y-1.5">
            <Label htmlFor={s.key}>{s.label ?? s.key}</Label>
            <Input id={s.key} name={s.key} defaultValue={s.value} />
          </div>
        ))}
        <p className="text-xs text-muted-foreground">Cost rules apply to every estimate on the site. Confirm current Tamil Nadu rates with the Registration Department before launch.</p>
        <Button type="submit" className="w-fit">Save settings</Button>
      </form>
    </Panel>
  );
}
