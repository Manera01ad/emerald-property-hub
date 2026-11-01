import { describe, expect, it, vi } from "vitest";
import {
  ESTIMATED_INPUT_TOKENS,
  ESTIMATED_OUTPUT_TOKENS,
  buildUsageRecord,
  costInr,
  reservationCostInr,
  roundInr,
} from "./cost";
import { ASSISTANT_MODEL_ID, INR_PER_USD, MODEL_PRICES, priceFor } from "./pricing";

describe("cost estimation", () => {
  it("converts tokens to rupees using the published rate", () => {
    // 1M input at $0.25 plus 1M output at $2.00 = $2.25.
    const cost = costInr(ASSISTANT_MODEL_ID, 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(2.25 * INR_PER_USD, 6);
  });

  it("prices input and output separately", () => {
    const inputOnly = costInr(ASSISTANT_MODEL_ID, 1_000_000, 0);
    const outputOnly = costInr(ASSISTANT_MODEL_ID, 0, 1_000_000);
    expect(outputOnly!).toBeGreaterThan(inputOnly!);
  });

  it("returns null for an unknown model rather than zero", () => {
    // Zero would read as free and let an unpriced model spend unbounded.
    expect(costInr("some/unknown-model", 1000, 1000)).toBeNull();
    expect(priceFor("some/unknown-model")).toBeNull();
  });

  it("returns null for a missing or invalid token count", () => {
    expect(costInr(ASSISTANT_MODEL_ID, Number.NaN, 10)).toBeNull();
    expect(costInr(ASSISTANT_MODEL_ID, -5, 10)).toBeNull();
    expect(costInr(ASSISTANT_MODEL_ID, 10, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("rounds to paise", () => {
    expect(roundInr(1.239)).toBe(1.24);
    expect(roundInr(1.234)).toBe(1.23);
  });

  it("keeps pricing in one place", () => {
    expect(MODEL_PRICES[ASSISTANT_MODEL_ID]).toBeDefined();
  });
});

describe("usage records", () => {
  it("marks real provider usage as measured", () => {
    const record = buildUsageRecord(ASSISTANT_MODEL_ID, { inputTokens: 1200, outputTokens: 400 });
    expect(record.usageSource).toBe("measured");
    expect(record.costMeasured).toBe(true);
    expect(record.inputTokens).toBe(1200);
    expect(record.outputTokens).toBe(400);
    expect(record.costInr).toBeGreaterThan(0);
  });

  it("falls back to the estimate and says so when usage is missing", () => {
    const record = buildUsageRecord(ASSISTANT_MODEL_ID, undefined);
    expect(record.usageSource).toBe("estimated");
    expect(record.costMeasured).toBe(false);
    // Never invents token counts it did not receive.
    expect(record.inputTokens).toBeNull();
    expect(record.outputTokens).toBeNull();
    expect(record.costInr).toBe(reservationCostInr(ASSISTANT_MODEL_ID));
  });

  it("treats a partially reported usage as estimated", () => {
    const record = buildUsageRecord(ASSISTANT_MODEL_ID, { inputTokens: 1200, outputTokens: null });
    expect(record.usageSource).toBe("estimated");
    expect(record.inputTokens).toBeNull();
  });

  it("does not claim a measured cost when the model is unpriced", () => {
    const record = buildUsageRecord("unknown/model", { inputTokens: 1000, outputTokens: 500 });
    expect(record.costMeasured).toBe(false);
    expect(record.costInr).toBeNull();
  });

  it("treats zero tokens as a real measurement", () => {
    // A refusal that produces no output is a measured zero, not a missing value.
    const record = buildUsageRecord(ASSISTANT_MODEL_ID, { inputTokens: 0, outputTokens: 0 });
    expect(record.usageSource).toBe("measured");
    expect(record.costInr).toBe(0);
  });
});

describe("reservation", () => {
  it("reserves the worst case, not the average", () => {
    const reserved = reservationCostInr(ASSISTANT_MODEL_ID)!;
    const typical = costInr(ASSISTANT_MODEL_ID, 500, 300)!;
    expect(reserved).toBeGreaterThan(typical);
  });

  it("is null for an unpriced model, which fails closed upstream", () => {
    expect(reservationCostInr("unknown/model")).toBeNull();
  });

  it("uses the documented estimate constants", () => {
    expect(reservationCostInr(ASSISTANT_MODEL_ID)).toBe(
      roundInr(costInr(ASSISTANT_MODEL_ID, ESTIMATED_INPUT_TOKENS, ESTIMATED_OUTPUT_TOKENS)!),
    );
  });
});
