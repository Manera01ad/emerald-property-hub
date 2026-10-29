import { MIN_COMPARABLES, pricePerSqft, type DealProperty } from "./deal";
import type { Evidence } from "./evidence";
import { transactionTypeOf, type TransactionType } from "./transaction";

export type PriceContext = {
  listings: number;
  medianPpsf: number | null;
  rangePpsf: { low: number; high: number } | null;
  evidence: Evidence;
  reason: string;
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const hi = sorted[mid] as number;
  return sorted.length % 2 ? hi : ((sorted[mid - 1] as number) + hi) / 2;
}

/**
 * Price context for one locality and one transaction. Fewer than MIN_COMPARABLES published
 * listings is UNKNOWN: a median of one or two homes would look like a market rate when it is
 * not.
 *
 * The transaction is part of the key. A locality's median monthly rent per sq ft and its
 * median sale price per sq ft are different markets, so mixing them would publish a figure
 * that describes neither. Defaults to sale, matching the column default.
 */
export function priceContext(listings: DealProperty[], type: TransactionType = "buy"): PriceContext {
  const rates = listings
    .filter((l) => transactionTypeOf(l) === type)
    .map(pricePerSqft)
    .filter((v): v is number => v != null);
  if (rates.length === 0) {
    return { listings: 0, medianPpsf: null, rangePpsf: null, evidence: "UNKNOWN", reason: "No published listings in this locality yet." };
  }
  if (rates.length < MIN_COMPARABLES) {
    return {
      listings: rates.length,
      medianPpsf: null,
      rangePpsf: null,
      evidence: "UNKNOWN",
      reason: `Only ${rates.length} published listing(s) with a usable area. At least ${MIN_COMPARABLES} are needed before a price figure means anything.`,
    };
  }
  const sorted = [...rates].sort((a, b) => a - b);
  const unit = type === "buy" ? "asking price" : `asking monthly ${type === "rent" ? "rent" : "lease"}`;
  return {
    listings: rates.length,
    medianPpsf: median(rates),
    rangePpsf: { low: sorted[0] as number, high: sorted[sorted.length - 1] as number },
    evidence: "ESTIMATE",
    reason: `Median ${unit} per sq ft across ${rates.length} published listings. Asking prices are claims by sellers, not confirmed prices.`,
  };
}
