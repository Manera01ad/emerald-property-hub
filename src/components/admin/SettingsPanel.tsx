import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Panel, useAdminTable, useInvalidateAdmin } from "./shared";

export function SettingsPanel() {
  const { data = [] } = useAdminTable("app_settings", "key");
  const inv = useInvalidateAdmin();

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
      <form onSubmit={save} className="grid max-w-2xl gap-4">
        {data.map((s) => (
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
