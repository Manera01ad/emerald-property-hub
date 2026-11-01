/**
 * Model pricing and the exchange-rate assumption, in one place.
 *
 * Every figure here is a configuration assumption, not a measured fact. The
 * provider bills in USD; the product reports in INR; the conversion is a single
 * stated rate so a cost shown to the owner can always be traced back to it.
 *
 * No secrets live here. The model identifier is public, and the rates are
 * published prices, not credentials.
 */

/** The assistant model. Changing this changes the price, so both move together. */
export const ASSISTANT_MODEL_ID = "openai/gpt-6-astra";

/** The AI gateway the assistant calls. */
export const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";

/**
 * Rupees per US dollar. A fixed assumption rather than a live rate: a live rate
 * would need a network call on the request path and would make a stored cost
 * unreproducible, since the same request would convert differently later.
 * Revisit when the error exceeds a few percent.
 */
export const INR_PER_USD = 88;

/** USD per one million tokens. */
export type ModelPrice = { inputPerMillionUsd: number; outputPerMillionUsd: number };

/**
 * Published rates for the assistant model. Kept as a map so a second model can
 * be priced without touching the calculation, and so a wrong rate is a one-line
 * fix in a reviewed diff.
 */
export const MODEL_PRICES: Record<string, ModelPrice> = {
  [ASSISTANT_MODEL_ID]: { inputPerMillionUsd: 0.25, outputPerMillionUsd: 2.0 },
};

/** Price for a model, or null when it is unknown. Null is never treated as free. */
export function priceFor(modelId: string): ModelPrice | null {
  return MODEL_PRICES[modelId] ?? null;
}
