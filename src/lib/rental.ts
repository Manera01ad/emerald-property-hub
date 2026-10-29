/**
 * Rental comparison. Monthly rent, deposit, maintenance, furnishing and availability.
 *
 * Every figure is labelled, and a total is UNKNOWN when any part of it is unknown. We never
 * treat a missing deposit or maintenance figure as zero, because that would understate the
 * cost and make one listing look cheaper than it is.
 *
 * Pure rules only, so this stays testable without a database.
 */

import type { Evidence } from "./evidence";

export const FURNISHING_STATES = ["unfurnished", "semi_furnished", "fully_furnished"] as const;
export type FurnishingState = (typeof FURNISHING_STATES)[number];

export const FURNISHING_LABELS: Record<FurnishingState, string> = {
  unfurnished: "Unfurnished",
  semi_furnished: "Semi-furnished",
  fully_furnished: "Fully furnished",
};

export function isFurnishingState(value: unknown): value is FurnishingState {
  return typeof value === "string" && (FURNISHING_STATES as readonly string[]).includes(value);
}

export function furnishingLabel(value: string | null | undefined): string {
  return isFurnishingState(value) ? FURNISHING_LABELS[value] : "Unknown";
}

/** The rental fields a comparison reads. All optional: an owner may not have stated them. */
export type RentalTerms = {
  monthly_rent: number | null;
  deposit: number | null;
  maintenance_monthly: number | null;
  furnishing: string | null;
  available_from: string | null;
  lease_months: number | null;
};

export type RentalField<T> = { value: T | null; evidence: Evidence; note: string };

function stated<T>(value: T | null | undefined, evidence: Evidence, note: string): RentalField<T> {
  if (value == null || (typeof value === "string" && value.trim() === "")) {
    return { value: null, evidence: "UNKNOWN", note: "Not stated by the owner or developer." };
  }
  return { value, evidence, note };
}

/**
 * Monthly outgoings: rent plus maintenance. Maintenance is frequently excluded from the
 * headline rent, so leaving it out would understate what a tenant pays each month.
 */
export type MonthlyOutgoings = {
  total: number | null;
  rent: number | null;
  maintenance: number | null;
  evidence: Evidence;
  note: string;
};

export function monthlyOutgoings(terms: RentalTerms): MonthlyOutgoings {
  const rent = terms.monthly_rent != null && terms.monthly_rent > 0 ? terms.monthly_rent : null;
  if (rent == null) {
    return {
      total: null,
      rent: null,
      maintenance: null,
      evidence: "UNKNOWN",
      note: "No monthly rent stated, so there is nothing to add up.",
    };
  }
  if (terms.maintenance_monthly == null) {
    return {
      total: null,
      rent,
      maintenance: null,
      evidence: "UNKNOWN",
      note: `Rent is ₹${rent.toLocaleString("en-IN")} a month, but maintenance is not stated, so the monthly total is unknown.`,
    };
  }
  const maintenance = Math.max(0, terms.maintenance_monthly);
  return {
    total: rent + maintenance,
    rent,
    maintenance,
    evidence: "CLAIM",
    note: `Rent plus stated maintenance. Both are figures the owner or developer gave us, not checked.`,
  };
}

/**
 * Move-in cash: deposit plus the first month. The deposit is refundable and is shown
 * separately, because it is a large one-off sum rather than a cost of living there.
 */
export type MoveInCash = {
  total: number | null;
  deposit: number | null;
  firstMonth: number | null;
  evidence: Evidence;
  note: string;
};

export function moveInCash(terms: RentalTerms): MoveInCash {
  const outgoings = monthlyOutgoings(terms);
  if (outgoings.total == null) {
    return {
      total: null,
      deposit: null,
      firstMonth: null,
      evidence: "UNKNOWN",
      note: "The monthly total is unknown, so move-in cash cannot be worked out.",
    };
  }
  if (terms.deposit == null) {
    return {
      total: null,
      deposit: null,
      firstMonth: outgoings.total,
      evidence: "UNKNOWN",
      note: "The deposit is not stated, so the cash needed to move in is unknown.",
    };
  }
  return {
    total: Math.max(0, terms.deposit) + outgoings.total,
    deposit: Math.max(0, terms.deposit),
    firstMonth: outgoings.total,
    evidence: "CLAIM",
    note: "Deposit plus the first month. The deposit is refundable, subject to the tenancy agreement.",
  };
}

export type RentalComparison = {
  monthly: MonthlyOutgoings;
  moveIn: MoveInCash;
  furnishing: RentalField<string>;
  availableFrom: RentalField<string>;
  /** How many of the five comparison fields we actually hold. */
  known: number;
  total: number;
  evidence: Evidence;
  gaps: string[];
};

const RENTAL_FIELDS = 5;

/**
 * A full rental comparison row. `evidence` is CLAIM only when every field is present:
 * a comparison built on some stated figures and some blanks is UNKNOWN, not a weak claim.
 */
export function compareRental(terms: RentalTerms): RentalComparison {
  const monthly = monthlyOutgoings(terms);
  const moveIn = moveInCash(terms);
  const furnishing = stated(terms.furnishing, "CLAIM", "Stated by the owner or developer.");
  const availableFrom = stated(terms.available_from, "CLAIM", "Stated by the owner or developer.");

  const gaps: string[] = [];
  if (monthly.total == null)
    gaps.push(
      monthly.maintenance == null && monthly.rent != null ? "Monthly maintenance" : "Monthly rent",
    );
  if (terms.deposit == null) gaps.push("Deposit");
  if (furnishing.value == null) gaps.push("Furnishing");
  if (availableFrom.value == null) gaps.push("Availability");

  const known = [
    monthly.total,
    terms.deposit,
    furnishing.value,
    availableFrom.value,
    terms.monthly_rent,
  ].filter((v) => v != null).length;

  return {
    monthly,
    moveIn,
    furnishing,
    availableFrom,
    known,
    total: RENTAL_FIELDS,
    evidence: known === RENTAL_FIELDS ? "CLAIM" : "UNKNOWN",
    gaps,
  };
}
