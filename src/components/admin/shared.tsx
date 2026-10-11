import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type T = keyof Database["public"]["Tables"];

export function useAdminTable<K extends T>(table: K, order = "created_at") {
  return useQuery({
    queryKey: ["admin", table],
    queryFn: async () => {
      const { data, error } = await supabase.from(table).select("*").order(order as never, { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Database["public"]["Tables"][K]["Row"][];
    },
  });
}

export function useInvalidateAdmin() {
  const qc = useQueryClient();
  return (table: T) => {
    qc.invalidateQueries({ queryKey: ["admin", table] });
    qc.invalidateQueries({ queryKey: ["properties"] });
    qc.invalidateQueries({ queryKey: ["settings"] });
  };
}

export const selectCls = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

export function Panel({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 rounded-xl border bg-card p-4 shadow-card md:p-6">{children}</div>;
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl text-primary">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
