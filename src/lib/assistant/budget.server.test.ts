/**
 * Tests for the budget enforcement adapter.
 *
 * These use a minimal stand-in for the Supabase client. That is deliberate: the
 * logic under test is the adapter's decision-making — what it does with a
 * refusal, a missing function, a thrown error — and that logic is real code
 * being exercised. Only the transport is replaced, because a live Postgres with
 * the migration applied is not available in this environment. The SQL itself is
 * NOT covered here and is flagged as untested in the pull request.
 */
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reconcileBudget, refusalFor, reserveBudget } from "./budget.server";
import { ASSISTANT_MODEL_ID } from "./pricing";
import { reservationCostInr } from "./cost";

const RESERVATION = reservationCostInr(ASSISTANT_MODEL_ID)!;

/** A client whose rpc() answers with whatever the case needs. */
function fakeClient(rpc: (fn: string, args: unknown) => unknown): SupabaseClient {
  return { rpc: vi.fn(rpc) } as unknown as SupabaseClient;
}

describe("reserveBudget", () => {
  it("reserves when the database allows it", async () => {
    const db = fakeClient(() => ({
      data: [
        { allowed: true, reservation_inr: RESERVATION, reservation_id: "res-1", reason: null },
      ],
      error: null,
    }));
    const result = await reserveBudget(db, ASSISTANT_MODEL_ID);
    expect(result).toEqual({ ok: true, id: "res-1", amountInr: RESERVATION });
  });

  it("accepts a single object as well as a one-row array", async () => {
    // PostgREST returns a set for a set-returning function; a scalar shape is
    // also seen in practice, so both are handled.
    const db = fakeClient(() => ({
      data: { allowed: true, reservation_inr: RESERVATION, reservation_id: "res-2", reason: null },
      error: null,
    }));
    const result = await reserveBudget(db, ASSISTANT_MODEL_ID);
    expect(result.ok).toBe(true);
  });

  it("reports the budget as exhausted when the database refuses on cost", async () => {
    const db = fakeClient(() => ({
      data: [
        {
          allowed: false,
          reservation_inr: RESERVATION,
          reservation_id: null,
          reason: "budget_exhausted",
        },
      ],
      error: null,
    }));
    const result = await reserveBudget(db, ASSISTANT_MODEL_ID);
    expect(result).toEqual({ ok: false, reason: "budget_exhausted" });
  });

  it("fails closed when the function is missing, as before the migration", async () => {
    // This is the state production is in today. It must not permit the call.
    const db = fakeClient(() => ({
      data: null,
      error: {
        message: "function public.reserve_ai_budget(numeric, numeric, text) does not exist",
      },
    }));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await reserveBudget(db, ASSISTANT_MODEL_ID);
    expect(result).toEqual({ ok: false, reason: "enforcement_unavailable" });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("fails closed on a permission error", async () => {
    const db = fakeClient(() => ({
      data: null,
      error: { message: "permission denied for function" },
    }));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await reserveBudget(db, ASSISTANT_MODEL_ID)).toEqual({
      ok: false,
      reason: "enforcement_unavailable",
    });
    error.mockRestore();
  });

  it("fails closed when the call throws", async () => {
    const db = fakeClient(() => {
      throw new Error("network down");
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await reserveBudget(db, ASSISTANT_MODEL_ID)).toEqual({
      ok: false,
      reason: "enforcement_unavailable",
    });
    error.mockRestore();
  });

  it("fails closed on an empty response", async () => {
    const db = fakeClient(() => ({ data: [], error: null }));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await reserveBudget(db, ASSISTANT_MODEL_ID)).ok).toBe(false);
    error.mockRestore();
  });

  it("refuses an unpriced model without calling the database", async () => {
    const rpc = vi.fn();
    const db = { rpc } as unknown as SupabaseClient;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await reserveBudget(db, "unknown/model")).toEqual({
      ok: false,
      reason: "unpriced_model",
    });
    // No point reserving an amount we cannot compute.
    expect(rpc).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("refuses every call when the configured budget is zero", async () => {
    const previous = process.env["AI_DAILY_BUDGET_INR"];
    process.env["AI_DAILY_BUDGET_INR"] = "0";
    const rpc = vi.fn();
    const db = { rpc } as unknown as SupabaseClient;
    expect(await reserveBudget(db, ASSISTANT_MODEL_ID)).toEqual({
      ok: false,
      reason: "budget_exhausted",
    });
    expect(rpc).not.toHaveBeenCalled();
    if (previous === undefined) delete process.env["AI_DAILY_BUDGET_INR"];
    else process.env["AI_DAILY_BUDGET_INR"] = previous;
  });

  it("does not return a spend total to the caller", async () => {
    // The function returns a decision; a total would be business information and
    // a cross-user leak. This guards the shape the adapter relies on.
    const db = fakeClient(() => ({
      data: [
        { allowed: true, reservation_inr: RESERVATION, reservation_id: "res-3", reason: null },
      ],
      error: null,
    }));
    const result = await reserveBudget(db, ASSISTANT_MODEL_ID);
    expect(Object.keys(result).sort()).toEqual(["amountInr", "id", "ok"]);
  });
});

describe("reconcileBudget", () => {
  const record = {
    model: ASSISTANT_MODEL_ID,
    inputTokens: 1000,
    outputTokens: 200,
    costInr: 1.2,
    usageSource: "measured" as const,
    costMeasured: true,
  };

  it("sends the measured usage to the database", async () => {
    const rpc = vi.fn(() => ({ data: null, error: null }));
    await reconcileBudget({ rpc } as unknown as SupabaseClient, "res-1", record);
    expect(rpc).toHaveBeenCalledWith("reconcile_ai_budget", {
      _reservation_id: "res-1",
      _actual_inr: 1.2,
      _input_tokens: 1000,
      _output_tokens: 200,
      _model: ASSISTANT_MODEL_ID,
      _usage_source: "measured",
      _cost_measured: true,
    });
  });

  it("passes nulls through for an estimated record rather than inventing counts", async () => {
    const calls: unknown[][] = [];
    const rpc = (...args: unknown[]) => {
      calls.push(args);
      return { data: null, error: null };
    };
    await reconcileBudget({ rpc } as unknown as SupabaseClient, "res-2", {
      model: ASSISTANT_MODEL_ID,
      inputTokens: null,
      outputTokens: null,
      costInr: 1.2,
      usageSource: "estimated",
      costMeasured: false,
    });
    const args = calls[0]![1] as Record<string, unknown>;
    expect(args["_input_tokens"]).toBeNull();
    expect(args["_output_tokens"]).toBeNull();
    expect(args["_usage_source"]).toBe("estimated");
  });

  it("never throws, because the call has already been paid for", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const db = {
      rpc: () => {
        throw new Error("boom");
      },
    } as unknown as SupabaseClient;
    await expect(reconcileBudget(db, "res-3", record)).resolves.toBeUndefined();
    error.mockRestore();
  });

  it("logs rather than throws when the database reports an error", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const db = {
      rpc: () => ({ data: null, error: { message: "nope" } }),
    } as unknown as SupabaseClient;
    await expect(reconcileBudget(db, "res-4", record)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("refusalFor", () => {
  it("tells the user to come back tomorrow only when the budget is genuinely spent", () => {
    expect(refusalFor("budget_exhausted")).toMatch(/today's usage limit/);
  });

  it("reads as an outage when enforcement is unavailable", () => {
    expect(refusalFor("enforcement_unavailable")).toMatch(/unavailable right now/);
  });

  it("does not blame the user for an unpriced model", () => {
    expect(refusalFor("unpriced_model")).toBe(refusalFor("enforcement_unavailable"));
  });
});
