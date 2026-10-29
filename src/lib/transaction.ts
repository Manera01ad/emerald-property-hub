/**
 * One property database, three transaction types. Buy, rent and lease share the same
 * listing record; the difference is which price and terms fields carry meaning.
 *
 * Pure rules only, so this stays testable without a database. No I/O here.
 */

import { formatINR } from "./format";
import { furnishingLabel } from "./rental";

export const TRANSACTION_TYPES = ["buy", "rent", "lease"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_LABELS: Record<TransactionType, string> = {
  buy: "Buy",
  rent: "Rent",
  lease: "Lease",
};

export const TRANSACTION_NOUNS: Record<TransactionType, string> = {
  buy: "home",
  rent: "rental",
  lease: "lease",
};

/** What a person is called on each side of the transaction. */
export const TRANSACTION_PARTICIPANTS: Record<
  TransactionType,
  { seeker: string; provider: string }
> = {
  buy: { seeker: "Buyer", provider: "Seller" },
  rent: { seeker: "Tenant", provider: "Landlord" },
  lease: { seeker: "Lessee", provider: "Lessor" },
};

export function isTransactionType(value: unknown): value is TransactionType {
  return typeof value === "string" && (TRANSACTION_TYPES as readonly string[]).includes(value);
}

/** Anything unrecognised falls back to buy, which is the launch default. */
export function asTransactionType(value: unknown): TransactionType {
  return isTransactionType(value) ? value : "buy";
}

/**
 * Rent and lease are recurring payments; buy is a one-off capital price. The figure is the
 * same database column, but the unit and the comparison basis differ, so the label must too.
 */
export function priceUnit(type: TransactionType): "total" | "per_month" {
  return type === "buy" ? "total" : "per_month";
}

export function priceLabel(type: TransactionType): string {
  return type === "buy" ? "Asking price" : "Monthly rent";
}

/** A budget the seeker states in a requirements form, in the unit that suits the type. */
export function budgetLabel(type: TransactionType): string {
  return type === "buy" ? "Budget (₹ lakhs)" : "Monthly budget (₹)";
}

/**
 * One figure, labelled so its unit cannot be mistaken. Every machine-readable surface (the
 * assistant tools and the MCP tools) uses this instead of passing asking_price through raw,
 * because a rent of 25000 and a sale of 25000000 are the same column and only the transaction
 * says which is which.
 */
export function priceFields(type: TransactionType, askingPrice: unknown) {
  const amount = numberOrNull(askingPrice);
  return {
    price: type === "buy" ? amount : null,
    monthly_figure: type === "buy" ? null : amount,
    price_unit: priceUnit(type),
  };
}

/**
 * Which terms a listing of this type must carry before it is comparable with another.
 * Buy needs an area to compute a price per sq ft; rent needs a deposit; lease needs a term.
 */
export const REQUIRED_TERMS: Record<TransactionType, readonly string[]> = {
  buy: [],
  rent: ["deposit", "maintenance_monthly", "furnishing", "available_from"],
  lease: ["lease_months", "deposit", "escalation_pct", "permitted_use", "renewal_terms"],
};

export type TermGap = { field: string; label: string };

const TERM_LABELS: Record<string, string> = {
  deposit: "Deposit",
  maintenance_monthly: "Monthly maintenance",
  furnishing: "Furnishing",
  available_from: "Available from",
  lease_months: "Lease duration",
  escalation_pct: "Annual escalation",
  permitted_use: "Permitted use",
  renewal_terms: "Renewal terms",
};

export function termLabel(field: string): string {
  return TERM_LABELS[field] ?? field;
}

/**
 * The terms we would need to compare this listing fairly. A gap is reported, never guessed,
 * so a comparison can say UNKNOWN instead of assuming a deposit of zero.
 */
export function missingTerms(type: TransactionType, listing: Record<string, unknown>): TermGap[] {
  return REQUIRED_TERMS[type]
    .filter((field) => {
      const value = listing[field];
      if (value == null) return true;
      return typeof value === "string" && value.trim() === "";
    })
    .map((field) => ({ field, label: termLabel(field) }));
}

/** A listing is complete for its type when no required term is missing. */
export function isCompleteForType(
  type: TransactionType,
  listing: Record<string, unknown>,
): boolean {
  return missingTerms(type, listing).length === 0;
}

/**
 * Whether a listing can be shown as a comparison candidate at all. A buy listing needs a
 * price; rent and lease need a monthly figure. Without it there is nothing to compare.
 */
export function hasComparablePrice(
  type: TransactionType,
  listing: Record<string, unknown>,
): boolean {
  return Number(listing["asking_price"]) > 0;
}

/**
 * The transaction columns, read through a narrow shape rather than the generated database
 * types. The generated types live under src/integrations/supabase/, which only the owner may
 * change, so new columns are reached this way until those types are regenerated.
 */
export type TransactionFields = {
  transaction_type?: string | null;
  deposit?: number | null;
  maintenance_monthly?: number | null;
  furnishing?: string | null;
  available_from?: string | null;
  lease_months?: number | null;
  escalation_pct?: number | null;
  permitted_use?: string | null;
  renewal_terms?: string | null;
};

export function transactionFields(row: unknown): TransactionFields {
  return (row ?? {}) as TransactionFields;
}

/** The transaction type of a listing row, defaulting to buy for rows written before 0019. */
export function transactionTypeOf(row: unknown): TransactionType {
  return asTransactionType(transactionFields(row).transaction_type);
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** Reads the rental and lease terms off a listing row for the comparison modules. */
export function termsOf(row: unknown, type: TransactionType) {
  const f = transactionFields(row);
  return {
    monthly_rent: numberOrNull((row as { asking_price?: unknown } | null)?.asking_price),
    deposit: numberOrNull(f.deposit),
    maintenance_monthly: numberOrNull(f.maintenance_monthly),
    furnishing: stringOrNull(f.furnishing),
    available_from: stringOrNull(f.available_from),
    lease_months: numberOrNull(f.lease_months),
    escalation_pct: numberOrNull(f.escalation_pct),
    permitted_use: stringOrNull(f.permitted_use),
    renewal_terms: stringOrNull(f.renewal_terms),
    type,
  };
}


/** Compact one-line summary for a search result card. */
export function termsSummary(listing: unknown, type: TransactionType): string | null {
  if (type === "buy") return null;
  const terms = termsOf(listing, type);
  if (type === "rent") {
    const parts = [
      terms.deposit != null ? `Deposit ${formatINR(terms.deposit)}` : "Deposit unknown",
    ];
    parts.push(
      terms.maintenance_monthly != null
        ? `Maintenance ${formatINR(terms.maintenance_monthly)}/mo`
        : "Maintenance unknown",
    );
    parts.push(furnishingLabel(terms.furnishing));
    return parts.join(" · ");
  }
  const parts = [terms.lease_months != null ? `${terms.lease_months} months` : "Term unknown"];
  parts.push(terms.deposit != null ? `Deposit ${formatINR(terms.deposit)}` : "Deposit unknown");
  parts.push(
    terms.escalation_pct != null ? `${terms.escalation_pct}% escalation` : "Escalation unknown",
  );
  return parts.join(" · ");
}
