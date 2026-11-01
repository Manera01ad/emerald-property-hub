import { describe, expect, it, vi } from "vitest";
import {
  BUDGET_EXHAUSTED_MESSAGE,
  DEFAULT_DAILY_BUDGET_INR,
  RESERVATION_TIMEOUT_MS,
  budgetDay,
  dailyBudgetInr,
  decideBudget,
  isStaleReservation,
  refusalMessage,
  reservationFor,
} from "./budget";
import { ASSISTANT_MODEL_ID } from "./pricing";

describe("daily budget configuration", () => {
  it("defaults when unset", () => {
    expect(dailyBudgetInr({})).toBe(DEFAULT_DAILY_BUDGET_INR);
  });

  it("reads the configured value", () => {
    expect(dailyBudgetInr({ AI_DAILY_BUDGET_INR: "1200" })).toBe(1200);
    expect(dailyBudgetInr({ AI_DAILY_BUDGET_INR: "0" })).toBe(0);
  });

  it("falls back rather than trusting a broken value", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(dailyBudgetInr({ AI_DAILY_BUDGET_INR: "lots" })).toBe(DEFAULT_DAILY_BUDGET_INR);
    expect(dailyBudgetInr({ AI_DAILY_BUDGET_INR: "-10" })).toBe(DEFAULT_DAILY_BUDGET_INR);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("budget day", () => {
  it("is a UTC calendar day", () => {
    // 00:30 UTC on the 2nd is still the 2nd, wherever the reader sits.
    expect(budgetDay(Date.UTC(2026, 10, 2, 0, 30))).toBe("2026-11-02");
    // 23:30 UTC on the 1st is still the 1st, not the 2nd.
    expect(budgetDay(Date.UTC(2026, 10, 1, 23, 30))).toBe("2026-11-01");
  });

  it("does not shift with the host timezone", () => {
    const instant = Date.UTC(2026, 10, 1, 18, 30);
    expect(budgetDay(instant)).toBe("2026-11-01");
  });
});

describe("budget decision", () => {
  const reservation = reservationFor(ASSISTANT_MODEL_ID)!;

  it("allows a call with headroom", () => {
    const decision = decideBudget({ spentInr: 0, reservedInr: 0 }, 100, reservation);
    expect(decision).toEqual({ allowed: true, reservationInr: reservation });
  });

  it("refuses once committed spend reaches the cap", () => {
    const decision = decideBudget({ spentInr: 100, reservedInr: 0 }, 100, reservation);
    expect(decision).toEqual({ allowed: false, reason: "budget_exhausted" });
  });

  it("counts in-flight reservations as committed", () => {
    // Without this, concurrent requests each see the same free headroom.
    const decision = decideBudget({ spentInr: 0, reservedInr: 100 }, 100, reservation);
    expect(decision).toEqual({ allowed: false, reason: "budget_exhausted" });
  });

  it("refuses the call that would cross the cap", () => {
    const decision = decideBudget(
      { spentInr: 100 - reservation / 2, reservedInr: 0 },
      100,
      reservation,
    );
    expect(decision.allowed).toBe(false);
  });

  it("fails closed for an unpriced model", () => {
    const decision = decideBudget({ spentInr: 0, reservedInr: 0 }, 100, null);
    expect(decision).toEqual({ allowed: false, reason: "unpriced_model" });
  });

  it("allows nothing when the budget is zero", () => {
    expect(decideBudget({ spentInr: 0, reservedInr: 0 }, 0, reservation).allowed).toBe(false);
  });

  it("admits exactly one call when the budget fits exactly one", () => {
    const first = decideBudget({ spentInr: 0, reservedInr: 0 }, reservation, reservation);
    expect(first.allowed).toBe(true);
    // Once reserved, the next caller sees it committed and is refused.
    const second = decideBudget(
      { spentInr: 0, reservedInr: reservation },
      reservation,
      reservation,
    );
    expect(second.allowed).toBe(false);
  });
});

describe("refusal messages", () => {
  it("uses the existing limit wording when the budget is spent", () => {
    expect(refusalMessage("budget_exhausted")).toBe(BUDGET_EXHAUSTED_MESSAGE);
    expect(BUDGET_EXHAUSTED_MESSAGE).toMatch(/Consult page/);
  });

  it("reads as an outage, not a user limit, when enforcement is broken", () => {
    const message = refusalMessage("enforcement_unavailable");
    expect(message).not.toBe(BUDGET_EXHAUSTED_MESSAGE);
    expect(message).toMatch(/Consult page/);
  });

  it("does not blame the user for an unpriced model", () => {
    expect(refusalMessage("unpriced_model")).toBe(refusalMessage("enforcement_unavailable"));
  });
});

describe("abandoned reservations", () => {
  const now = Date.UTC(2026, 10, 1, 12, 0, 0);

  it("keeps a recent reservation", () => {
    expect(isStaleReservation(new Date(now - 1000).toISOString(), now)).toBe(false);
  });

  it("releases a reservation older than the timeout", () => {
    expect(isStaleReservation(new Date(now - RESERVATION_TIMEOUT_MS - 1).toISOString(), now)).toBe(
      true,
    );
  });

  it("treats an unparseable timestamp as stale, so budget cannot be held forever", () => {
    expect(isStaleReservation("not-a-date", now)).toBe(true);
  });
});

/**
 * The concurrency invariant, modelled.
 *
 * The real serialisation is an advisory lock inside reserve_ai_budget, and it
 * cannot run here without Postgres. What is testable is the rule the database
 * follows: a reservation that has been made counts against the budget for every
 * later caller, so the number of calls admitted never exceeds what the budget
 * covers. This walks that rule sequentially, which is the same order the lock
 * imposes on concurrent requests.
 */
describe("concurrent reservations", () => {
  const reservation = reservationFor(ASSISTANT_MODEL_ID)!;

  /** Apply the database's decision rule to a ledger, returning the new ledger. */
  function attempt(
    ledger: { spentInr: number; reservedInr: number },
    budgetInr: number,
  ): { ledger: { spentInr: number; reservedInr: number }; allowed: boolean } {
    const decision = decideBudget(ledger, budgetInr, reservation);
    if (!decision.allowed) return { ledger, allowed: false };
    return {
      ledger: {
        spentInr: ledger.spentInr,
        reservedInr: ledger.reservedInr + decision.reservationInr,
      },
      allowed: true,
    };
  }

  it("admits exactly one call when the budget covers exactly one", () => {
    let ledger = { spentInr: 0, reservedInr: 0 };
    let allowed = 0;
    for (let i = 0; i < 10; i += 1) {
      const result = attempt(ledger, reservation);
      ledger = result.ledger;
      if (result.allowed) allowed += 1;
    }
    expect(allowed).toBe(1);
  });

  it("never admits more than the budget covers, across a burst", () => {
    const budget = reservation * 7;
    let ledger = { spentInr: 0, reservedInr: 0 };
    let allowed = 0;
    for (let i = 0; i < 50; i += 1) {
      const result = attempt(ledger, budget);
      ledger = result.ledger;
      if (result.allowed) allowed += 1;
    }
    // Seven reservations fit; floating point can cost at most the last one.
    expect(allowed).toBeLessThanOrEqual(7);
    expect(allowed).toBeGreaterThanOrEqual(6);
    expect(ledger.reservedInr).toBeLessThanOrEqual(budget + 1e-9);
  });

  it("keeps the cap once reservations are reconciled to real cost", () => {
    // A reservation reconciled to less than reserved frees the difference for
    // the next caller; this is what stops the cap from ratcheting down.
    let ledger = { spentInr: 0, reservedInr: 0 };
    const first = attempt(ledger, reservation * 2);
    ledger = first.ledger;
    // Reconciled at half the reservation.
    ledger = { spentInr: reservation / 2, reservedInr: 0 };
    expect(decideBudget(ledger, reservation * 2, reservation).allowed).toBe(true);
  });
});
