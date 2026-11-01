/**
 * Cost measurement for one assistant call.
 *
 * Two things matter more than precision here. First, a cost is either measured
 * from provider usage metadata or estimated, and the two are never conflated —
 * an invented token count would silently understate or overstate spend. Second,
 * an unknown price yields null, never zero, because zero reads as "free" and
 * would let an unpriced model spend without ever tripping the budget.
 */
import { ASSISTANT_MODEL_ID, INR_PER_USD, priceFor } from "./pricing";

/** Whether the numbers came from the provider or from our own estimate. */
export type UsageSource = "measured" | "estimated";

export type UsageRecord = {
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costInr: number | null;
  usageSource: UsageSource;
  /** True only when costInr came from real token counts and a known price. */
  costMeasured: boolean;
};

/** Token usage as the provider reports it. Either side may be absent. */
export type ProviderUsage = {
  inputTokens?: number | null | undefined;
  outputTokens?: number | null | undefined;
};

/**
 * A deliberately conservative per-call estimate used to reserve budget before
 * the call. It is the worst case we expect, not the average: reserving the
 * average would let a burst of long answers overshoot the daily cap.
 */
export const ESTIMATED_INPUT_TOKENS = 6_000;
export const ESTIMATED_OUTPUT_TOKENS = 1_500;

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** Convert tokens to rupees, or null when the model has no published price. */
export function costInr(model: string, inputTokens: number, outputTokens: number): number | null {
  const price = priceFor(model);
  if (!price) return null;
  if (!isPositiveInt(inputTokens) || !isPositiveInt(outputTokens)) return null;

  const usd =
    (inputTokens / 1_000_000) * price.inputPerMillionUsd +
    (outputTokens / 1_000_000) * price.outputPerMillionUsd;
  return usd * INR_PER_USD;
}

/** Round to paise. Stored values stay legible and stable across comparisons. */
export function roundInr(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Build the record to store after a call finishes.
 *
 * When the provider omits usage we fall back to the reservation estimate and
 * label it `estimated`, so the row is never presented as measured. This is the
 * only place that decides that label.
 */
export function buildUsageRecord(
  model: string,
  usage: ProviderUsage | undefined | null,
): UsageRecord {
  const input = usage?.inputTokens;
  const output = usage?.outputTokens;
  const hasMeasured = isPositiveInt(input) && isPositiveInt(output);

  if (hasMeasured) {
    const cost = costInr(model, input, output);
    return {
      model,
      inputTokens: input,
      outputTokens: output,
      costInr: cost === null ? null : roundInr(cost),
      usageSource: "measured",
      // Measured tokens with no published price is still not a measured cost.
      costMeasured: cost !== null,
    };
  }

  const cost = costInr(model, ESTIMATED_INPUT_TOKENS, ESTIMATED_OUTPUT_TOKENS);
  return {
    model,
    inputTokens: null,
    outputTokens: null,
    costInr: cost === null ? null : roundInr(cost),
    usageSource: "estimated",
    costMeasured: false,
  };
}

/** The amount to reserve before the call, using the same estimate. */
export function reservationCostInr(model: string = ASSISTANT_MODEL_ID): number | null {
  const cost = costInr(model, ESTIMATED_INPUT_TOKENS, ESTIMATED_OUTPUT_TOKENS);
  return cost === null ? null : roundInr(cost);
}
