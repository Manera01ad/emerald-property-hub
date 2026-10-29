import { MIN_COMPARABLES, pricePerSqft, type DealProperty } from "./deal";
import type { Evidence } from "./evidence";

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
 * Price context for one locality. Fewer than MIN_COMPARABLES published listings is
 * UNKNOWN: a median of one or two homes would look like a market rate when it is not.
 */
export function priceContext(listings: DealProperty[]): PriceContext {
  const rates = listings.map(pricePerSqft).filter((v): v is number => v != null);
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
  return {
    listings: rates.length,
    medianPpsf: median(rates),
    rangePpsf: { low: sorted[0] as number, high: sorted[sorted.length - 1] as number },
    evidence: "ESTIMATE",
    reason: `Median asking price per sq ft across ${rates.length} published listings. Asking prices are claims by sellers, not confirmed sale prices.`,
  };
}
