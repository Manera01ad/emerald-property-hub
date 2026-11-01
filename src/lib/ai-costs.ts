/**
 * Reading AI spend for the admin control centre.
 *
 * Two things are worth knowing before reading this file.
 *
 * The cast. The database types in `src/integrations/supabase/types.ts` are
 * generated from the live schema, and `ai_usage_log` / `ai_budget_ledger` are
 * still in `drizzle/pending/`, so they are not in those types yet. The cast
 * below bridges that gap and disappears once the owner applies the migration and
 * regenerates. It is a compile-time convenience only: the real control is the
 * admin-only row-level security policy in the migration, so a wrong cast cannot
 * leak a row.
 *
 * The aggregation is pure. `summariseSpend` takes rows and returns numbers, so
 * the arithmetic is tested without a database.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { budgetDay } from "./assistant/budget";

export type UsageRow = {
  cost_inr: number | string | null;
  usage_source: string;
  cost_measured: boolean;
  model: string;
  created_at: string;
};

export type LedgerRow = {
  reserved_inr: number | string | null;
  actual_inr: number | string | null;
  reconciled_at: string | null;
  created_at: string;
};

export type SpendSummary = {
  spentInr: number;
  reservedInr: number;
  calls: number;
  estimated: number;
  unpriced: number;
};

function num(value: unknown): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Totals for one UTC day.
 *
 * Rows with a null cost are counted as unpriced rather than as zero, so a model
 * with no configured rate is visible instead of silently free.
 */
export function summariseSpend(
  usage: UsageRow[],
  ledger: LedgerRow[],
  day: string = budgetDay(),
): SpendSummary {
  const todayUsage = usage.filter((r) => r.created_at.slice(0, 10) === day);
  const todayLedger = ledger.filter((r) => r.created_at.slice(0, 10) === day);

  return {
    spentInr: todayUsage.reduce((sum, r) => sum + num(r.cost_inr), 0),
    reservedInr: todayLedger
      .filter((r) => !r.reconciled_at)
      .reduce((sum, r) => sum + num(r.reserved_inr), 0),
    calls: todayUsage.length,
    estimated: todayUsage.filter((r) => r.usage_source === "estimated").length,
    unpriced: todayUsage.filter((r) => r.cost_inr === null).length,
  };
}

/**
 * Read both tables as the signed-in admin. No service-role key is used: the
 * admin-only policy in the migration already restricts both tables, so the
 * caller's own client is the correct and least-privileged way in.
 */
export async function fetchAiSpend(
  db: SupabaseClient,
): Promise<{ usage: UsageRow[]; ledger: LedgerRow[] }> {
  // The only cast in the feature. See the file header.
  const loose = db as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        order: (
          column: string,
          options: { ascending: boolean },
        ) => {
          limit: (
            count: number,
          ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
        };
      };
    };
  };

  const usageResult = await loose
    .from("ai_usage_log")
    .select("cost_inr, usage_source, cost_measured, model, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (usageResult.error) throw new Error(usageResult.error.message);

  const ledgerResult = await loose
    .from("ai_budget_ledger")
    .select("reserved_inr, actual_inr, reconciled_at, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (ledgerResult.error) throw new Error(ledgerResult.error.message);

  return {
    usage: (usageResult.data ?? []) as UsageRow[],
    ledger: (ledgerResult.data ?? []) as LedgerRow[],
  };
}
