/**
 * Server-side budget enforcement.
 *
 * The whole point of this module is that the check happens where the money is
 * spent, not in the browser. It calls a narrowly scoped database function that
 * reserves budget atomically, so two requests arriving together cannot both
 * pass the same check.
 *
 * Every failure path here refuses the call. A missing function, a permission
 * error and a network fault all end in `enforcement_unavailable`, because the
 * alternative — treating an error as permission — turns one broken deploy into
 * an unbounded bill.
 *
 * This module also holds the only code that touches cross-user spend. The
 * database function returns a decision, never a total, so no caller can read
 * another user's usage even indirectly.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BUDGET_TIMEZONE,
  dailyBudgetInr,
  refusalMessage,
  reservationFor,
  type BudgetDecision,
} from "./budget";
import { ASSISTANT_MODEL_ID } from "./pricing";
import { buildUsageRecord, type UsageRecord } from "./cost";

/** What the database function returns. Deliberately not a spend total. */
type ReservationRow = {
  allowed: boolean;
  reservation_inr: number | string | null;
  reservation_id: string | null;
  reason: string | null;
};

export type Reservation =
  | { ok: true; id: string; amountInr: number }
  | { ok: false; reason: "budget_exhausted" | "enforcement_unavailable" | "unpriced_model" };

function num(value: unknown): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Ask for budget before the call.
 *
 * `db` must be a client acting as the caller under RLS, or an admin client used
 * only from the server. It is never a browser client.
 */
export async function reserveBudget(
  db: SupabaseClient,
  model: string = ASSISTANT_MODEL_ID,
): Promise<Reservation> {
  const amount = reservationFor(model);
  if (amount === null) {
    console.error(`assistant: no price configured for ${model}; refusing the call`);
    return { ok: false, reason: "unpriced_model" };
  }

  const budget = dailyBudgetInr();
  if (budget <= 0) {
    // A zero budget is a deliberate stop, not a misconfiguration to work around.
    return { ok: false, reason: "budget_exhausted" };
  }

  try {
    const { data, error } = await db.rpc("reserve_ai_budget", {
      _reservation_inr: amount,
      _daily_budget_inr: budget,
      _timezone: BUDGET_TIMEZONE,
    });

    if (error) {
      // Missing function (migration not applied) or a permissions problem.
      console.error("assistant: budget reservation failed", error.message);
      return { ok: false, reason: "enforcement_unavailable" };
    }

    const row = (Array.isArray(data) ? data[0] : data) as ReservationRow | null;
    if (!row) {
      console.error("assistant: budget reservation returned nothing");
      return { ok: false, reason: "enforcement_unavailable" };
    }
    if (row.allowed !== true || !row.reservation_id) {
      const reason =
        row.reason === "budget_exhausted" ? "budget_exhausted" : "enforcement_unavailable";
      return { ok: false, reason };
    }

    return { ok: true, id: row.reservation_id, amountInr: num(row.reservation_inr ?? amount) };
  } catch (error) {
    console.error("assistant: budget reservation threw", error);
    return { ok: false, reason: "enforcement_unavailable" };
  }
}

/**
 * Close a reservation with what was actually used.
 *
 * Best-effort by design: the call has already been paid for, so a failure here
 * must not surface to the user. It is logged instead, and the abandoned-
 * reservation sweep in the database releases anything left open.
 */
export async function reconcileBudget(
  db: SupabaseClient,
  reservationId: string,
  record: UsageRecord,
): Promise<void> {
  try {
    const { error } = await db.rpc("reconcile_ai_budget", {
      _reservation_id: reservationId,
      _actual_inr: record.costInr,
      _input_tokens: record.inputTokens,
      _output_tokens: record.outputTokens,
      _model: record.model,
      _usage_source: record.usageSource,
      _cost_measured: record.costMeasured,
    });
    if (error) console.error("assistant: budget reconciliation failed", error.message);
  } catch (error) {
    console.error("assistant: budget reconciliation threw", error);
  }
}

/** Record usage for a call that never held a reservation, such as a refusal. */
export async function logUsage(
  db: SupabaseClient,
  record: UsageRecord,
  status: string,
): Promise<void> {
  try {
    const { error } = await db.from("ai_usage_log").insert({
      model: record.model,
      input_tokens: record.inputTokens,
      output_tokens: record.outputTokens,
      cost_inr: record.costInr,
      usage_source: record.usageSource,
      cost_measured: record.costMeasured,
      status,
    });
    if (error) console.error("assistant: usage log failed", error.message);
  } catch (error) {
    console.error("assistant: usage log threw", error);
  }
}

/** The user-facing message for a refused reservation. */
export function refusalFor(
  reason: "budget_exhausted" | "enforcement_unavailable" | "unpriced_model",
): string {
  return refusalMessage(reason);
}

/** Whether the budget can currently be enforced at all, for the admin warning. */
export async function budgetEnforcementAvailable(db: SupabaseClient): Promise<boolean> {
  try {
    const { error } = await db.rpc("reserve_ai_budget", {
      _reservation_inr: 0,
      _daily_budget_inr: 0,
      _timezone: BUDGET_TIMEZONE,
    });
    // A zero-budget probe must be refused; reaching the function at all is the signal.
    return !error;
  } catch {
    return false;
  }
}

export type { BudgetDecision };
