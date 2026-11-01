import { describe, expect, it } from "vitest";
import { summariseSpend, type LedgerRow, type UsageRow } from "./ai-costs";

const DAY = "2026-11-01";
const usage = (over: Partial<UsageRow> = {}): UsageRow => ({
  cost_inr: 1.5,
  usage_source: "measured",
  cost_measured: true,
  model: "openai/gpt-6-astra",
  created_at: `${DAY}T10:00:00.000Z`,
  ...over,
});

const ledger = (over: Partial<LedgerRow> = {}): LedgerRow => ({
  reserved_inr: 1.6,
  actual_inr: null,
  reconciled_at: null,
  created_at: `${DAY}T10:00:00.000Z`,
  ...over,
});

describe("AI spend summary", () => {
  it("totals only the requested day", () => {
    const summary = summariseSpend(
      [usage(), usage({ created_at: "2026-10-31T10:00:00.000Z" })],
      [],
      DAY,
    );
    expect(summary.calls).toBe(1);
    expect(summary.spentInr).toBeCloseTo(1.5);
  });

  it("counts only unreconciled reservations as in flight", () => {
    const summary = summariseSpend(
      [],
      [ledger(), ledger({ reconciled_at: `${DAY}T10:05:00.000Z` })],
      DAY,
    );
    expect(summary.reservedInr).toBeCloseTo(1.6);
  });

  it("parses numeric strings from Postgres", () => {
    // numeric columns arrive as strings over PostgREST.
    const summary = summariseSpend(
      [usage({ cost_inr: "2.25" })],
      [ledger({ reserved_inr: "0.75" })],
      DAY,
    );
    expect(summary.spentInr).toBeCloseTo(2.25);
    expect(summary.reservedInr).toBeCloseTo(0.75);
  });

  it("counts estimated calls separately from measured ones", () => {
    const summary = summariseSpend(
      [usage(), usage({ usage_source: "estimated", cost_measured: false })],
      [],
      DAY,
    );
    expect(summary.calls).toBe(2);
    expect(summary.estimated).toBe(1);
  });

  it("counts a null cost as unpriced rather than free", () => {
    const summary = summariseSpend([usage({ cost_inr: null, cost_measured: false })], [], DAY);
    expect(summary.unpriced).toBe(1);
    expect(summary.spentInr).toBe(0);
  });

  it("returns zeros for an empty day", () => {
    expect(summariseSpend([], [], DAY)).toEqual({
      spentInr: 0,
      reservedInr: 0,
      calls: 0,
      estimated: 0,
      unpriced: 0,
    });
  });

  it("ignores unparseable values instead of producing NaN", () => {
    const summary = summariseSpend([usage({ cost_inr: "not-a-number" })], [], DAY);
    expect(summary.spentInr).toBe(0);
    expect(Number.isNaN(summary.spentInr)).toBe(false);
  });
});
