import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/format";

export function Buyers() {
  const profiles = useQuery({ queryKey: ["admin", "buyer_profiles"], queryFn: async () => (await supabase.from("buyer_profiles").select("*").order("updated_at", { ascending: false })).data ?? [] });
  const reports = useQuery({ queryKey: ["admin", "buyer_reports"], queryFn: async () => (await supabase.from("buyer_reports").select("id,user_id,title,kind,created_at").order("created_at", { ascending: false }).limit(100)).data ?? [] });
  const count = (uid: string) => (reports.data ?? []).filter((r) => r.user_id === uid).length;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Read-only view of buyer and renter preferences and saved reports. Buyers can edit or delete their own data at any time.</p>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left"><th className="p-3">Intent</th><th className="p-3">Budget</th><th className="p-3">Locations</th><th className="p-3">Bedrooms</th><th className="p-3">Move-in</th><th className="p-3">Reports</th></tr></thead>
          <tbody>
            {(profiles.data ?? []).length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No buyer profiles yet.</td></tr>}
            {(profiles.data ?? []).map((p) => (
              <tr key={p.id} className="border-b">
                <td className="p-3 capitalize">{p.intent}</td>
                <td className="p-3">{p.intent === "rent" ? (p.monthly_rent_budget ? `${formatINR(p.monthly_rent_budget)}/mo` : "—") : p.budget ? formatINR(p.budget) : "—"}</td>
                <td className="p-3">{p.preferred_locations.join(", ") || "—"}</td>
                <td className="p-3">{p.bedrooms ?? "—"}</td>
                <td className="p-3">{p.move_in_timeframe ?? "—"}</td>
                <td className="p-3">{count(p.user_id)}</td>
              </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
