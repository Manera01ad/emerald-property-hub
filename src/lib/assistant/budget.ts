/**
 * The global daily AI spending cap.
 *
 * The per-user limit of 15 messages bounds one person; it does not bound the
 * total bill, because the number of users is unbounded. This adds the missing
 * ceiling: a rupee amount the owner sets, enforced before every paid call.
 *
 * Two rules shape everything below.
 *
 * Fail closed. If the enforcing function is missing or errors, paid calls are
 * refused rather than allowed. An unpriced model, a broken reservation and an
 * absent migration all end in the same place — no spend — because the failure
 * mode of the alternative is an unbounded bill.
 *
 * One timezone. The budget day is UTC, stated here and in the migration. A
 * boundary that drifts with the reader's clock is not a limit.
 */
import { ASSISTANT_MODEL_ID } from "./pricing";
import { reservationCostInr } from "./cost";

/**
 * The default daily cap in rupees. Overridable with AI_DAILY_BUDGET_INR so the
 * owner can change it without a deploy. At roughly ₹1.6 per reservation this
 * default allows on the order of 300 calls a day, which is a ceiling rather
 * than a target.
 */
export const DEFAULT_DAILY_BUDGET_INR = 500;

/** Every budget boundary is UTC. */
export const BUDGET_TIMEZONE = "UTC";

export function dailyBudgetInr(env: Record<string, string | undefined> = process.env): number {
  const raw = env["AI_DAILY_BUDGET_INR"];
  if (!raw) return DEFAULT_DAILY_BUDGET_INR;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    console.error(
      `assistant: AI_DAILY_BUDGET_INR is not a usable number (${raw}); using the default.`,
    );
    return DEFAULT_DAILY_BUDGET_INR;
  }
  return parsed;
}

/** The UTC calendar day a timestamp falls in, as YYYY-MM-DD. */
export function budgetDay(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export type BudgetState = {
  /** Cost of calls already reconciled today. */
  spentInr: number;
  /** Cost of calls in flight that have not been reconciled yet. */
  reservedInr: number;
};

export type BudgetDecision =
  | { allowed: true; reservationInr: number }
  | { allowed: false; reason: "budget_exhausted" | "enforcement_unavailable" | "unpriced_model" };

/**
 * Decide whether one more call may be made.
 *
 * Reserved amounts count against the budget alongside actual spend, so several
 * requests arriving together cannot each see the same remaining headroom.
 */
export function decideBudget(
  state: BudgetState,
  budgetInr: number,
  reservationInr: number | null,
): BudgetDecision {
  if (reservationInr === null) return { allowed: false, reason: "unpriced_model" };
  const committed = state.spentInr + state.reservedInr;
  if (committed + reservationInr > budgetInr) return { allowed: false, reason: "budget_exhausted" };
  return { allowed: true, reservationInr };
}

export const BUDGET_EXHAUSTED_MESSAGE =
  "The assistant has reached today's usage limit. Please try again tomorrow, or use the Consult page for personal help.";

export const ENFORCEMENT_UNAVAILABLE_MESSAGE =
  "The assistant is unavailable right now. Please try again later or use the Consult page.";

/** Message for a decision that refused the call. */
export function refusalMessage(
  reason: "budget_exhausted" | "enforcement_unavailable" | "unpriced_model",
): string {
  if (reason === "budget_exhausted") return BUDGET_EXHAUSTED_MESSAGE;
  // An unpriced model is a configuration fault, not a user's problem, so it reads
  // as a temporary outage rather than a limit the user hit.
  return ENFORCEMENT_UNAVAILABLE_MESSAGE;
}

/** The amount to reserve for one call on the assistant model. */
export function reservationFor(model: string = ASSISTANT_MODEL_ID): number | null {
  return reservationCostInr(model);
}

/**
 * Whether a reservation has been open long enough to be treated as abandoned.
 *
 * A crashed process must not hold budget forever. Five minutes is well beyond a
 * normal answer, so a reservation older than this is treated as dead and its
 * amount is released on the next check.
 */
export const RESERVATION_TIMEOUT_MS = 5 * 60 * 1000;

export function isStaleReservation(createdAt: string, now: number = Date.now()): boolean {
  const started = Date.parse(createdAt);
  if (Number.isNaN(started)) return true;
  return now - started > RESERVATION_TIMEOUT_MS;
}
