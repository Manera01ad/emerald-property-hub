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

/**
 * Read an environment variable where one exists. `pricing.ts` is also reached
 * from the admin UI bundle, where `process` is absent, so this returns undefined
 * rather than throwing in the browser.
 */
function env(name: string): string | undefined {
  return typeof process !== "undefined" ? process.env?.[name] : undefined;
}

/** The assistant model. Changing this changes the price, so both move together. */
export const ASSISTANT_MODEL_ID = env("AI_MODEL") || "openai/gpt-6-astra";

/**
 * The AI gateway the assistant calls. An OpenAI-compatible base URL, so the
 * provider can be swapped by configuration alone: the Lovable gateway by
 * default, or OpenAI, Google Gemini, Groq or OpenRouter (each has a free tier)
 * by setting `AI_BASE_URL`.
 */
export const AI_GATEWAY_URL = env("AI_BASE_URL") || "https://ai.gateway.lovable.dev/v1";

/**
 * The API key for that endpoint. `AI_API_KEY` is the neutral name; the Lovable
 * name is a fallback so an existing deployment keeps working during migration.
 * When neither is set the assistant is treated as unconfigured and refuses the
 * call before spending anything.
 */
export function aiApiKey(): string | undefined {
  return env("AI_API_KEY") || env("LOVABLE_API_KEY");
}

/**
 * Extra headers the endpoint needs beyond `Authorization`. The Lovable gateway
 * wants its key in its own header plus an SDK marker; most providers want
 * neither. Kept here so `chat.server.ts` stays provider-agnostic.
 */
export function aiProviderHeaders(apiKey: string): Record<string, string> {
  if (AI_GATEWAY_URL.includes("gateway.lovable.dev")) {
    return { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" };
  }
  return {};
}

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
