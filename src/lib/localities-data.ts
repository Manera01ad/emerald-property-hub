import { supabase } from "@/integrations/supabase/client";
import type { Locality } from "./localities";

/**
 * The localities table is created by migration 0014 and is not in the generated
 * database types yet, and the generated types file is owner-only. This narrow
 * shape reaches the table without editing it or casting to any.
 */
type Row = Record<string, unknown>;
type Result = { data: Row[] | null; error: { message: string } | null };
type Filter = PromiseLike<Result> & { eq: (column: string, value: unknown) => Filter };
type Table = {
  select: (columns?: string) => Filter;
  update: (patch: Row) => Filter;
};
type LocalityDb = { from: (table: "localities") => Table };

export function localityDb(): LocalityDb {
  return supabase as unknown as LocalityDb;
}

export async function updateLocality(id: string, patch: Partial<Pick<Locality, "tier" | "status">>): Promise<void> {
  const { error } = await localityDb()
    .from("localities")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
