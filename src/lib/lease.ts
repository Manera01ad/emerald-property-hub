/**
 * Lease comparison. Lease duration, deposit, escalation, permitted use and renewal terms.
 *
 * A lease is a longer commitment than a tenancy and its risk sits in the terms, not only the
 * rent: an escalation clause, a restricted permitted use or a term with no renewal right
 * changes what the lessee is signing. Each of those is shown as stated or UNKNOWN, and the
 * total cost of the lease is UNKNOWN unless the escalation terms are known.
 *
 * Pure rules only, so this stays testable without a database.
 */

import type { Evidence } from "./evidence";
import { monthlyOutgoings, type RentalTerms } from "./rental";

export const PERMITTED_USES = [
  "residential",
  "commercial",
  "office",
  "retail",
  "industrial",
  "mixed",
] as const;
export type PermittedUse = (typeof PERMITTED_USES)[number];

export const PERMITTED_USE_LABELS: Record<PermittedUse, string> = {
  residential: "Residential",
  commercial: "Commercial",
  office: "Office",
  retail: "Retail",
  industrial: "Industrial",
  mixed: "Mixed use",
};

export function isPermittedUse(value: unknown): value is PermittedUse {
  return typeof value === "string" && (PERMITTED_USES as readonly string[]).includes(value);
}

export function permittedUseLabel(value: string | null | undefined): string {
  return isPermittedUse(value) ? PERMITTED_USE_LABELS[value] : "Unknown";
}

export const RENEWAL_STATES = ["renewable", "not_renewable", "by_agreement"] as const;
export type RenewalState = (typeof RENEWAL_STATES)[number];

export const RENEWAL_LABELS: Record<RenewalState, string> = {
  renewable: "Renewable",
  not_renewable: "Not renewable",
  by_agreement: "By fresh agreement at the end of the term",
};

export function renewalLabel(value: string | null | undefined): string {
  return typeof value === "string" && (RENEWAL_STATES as readonly string[]).includes(value)
    ? RENEWAL_LABELS[value as RenewalState]
    : "Unknown";
}

export type LeaseTerms = RentalTerms & {
  lease_months: number | null;
  escalation_pct: number | null;
  permitted_use: string | null;
  renewal_terms: string | null;
};

/**
 * Total rent over the lease term, with the stated annual escalation applied.
 * UNKNOWN when the term or the escalation is missing: a straight rent x months figure would
 * silently assume no escalation, which is the clause that most often surprises a lessee.
 */
export type LeaseTotal = {
  total: number | null;
  firstYearRent: number | null;
  finalYearMonthlyRent: number | null;
  evidence: Evidence;
  note: string;
};

export function leaseTotal(terms: LeaseTerms): LeaseTotal {
  const outgoings = monthlyOutgoings(terms);
  if (outgoings.rent == null) {
    return {
      total: null,
      firstYearRent: null,
      finalYearMonthlyRent: null,
      evidence: "UNKNOWN",
      note: "No monthly rent stated.",
    };
  }
  const firstYearRent = outgoings.rent * 12;
  if (terms.lease_months == null || terms.lease_months <= 0) {
    return {
      total: null,
      firstYearRent,
      finalYearMonthlyRent: null,
      evidence: "UNKNOWN",
      note: "The lease duration is not stated, so the total cannot be worked out.",
    };
  }
  if (terms.escalation_pct == null) {
    return {
      total: null,
      firstYearRent,
      finalYearMonthlyRent: null,
      evidence: "UNKNOWN",
      note: "The escalation clause is not stated, so the total is unknown. A figure without it would assume no increase.",
    };
  }
  const years = terms.lease_months / 12;
  const escalation = 1 + terms.escalation_pct / 100;
  let total = 0;
  for (let y = 0; y < Math.ceil(years); y++) {
    const monthsThisYear = Math.min(12, terms.lease_months - y * 12);
    total += outgoings.rent * escalation ** y * monthsThisYear;
  }
  const finalYearMonthlyRent = outgoings.rent * escalation ** Math.max(0, Math.ceil(years) - 1);
  return {
    total,
    firstYearRent,
    finalYearMonthlyRent,
    evidence: "ESTIMATE",
    note: `Rent over ${terms.lease_months} months with the stated ${terms.escalation_pct}% annual escalation. Maintenance is excluded because it is not part of the lease rent.`,
  };
}

export type LeaseComparison = {
  duration: { months: number | null; evidence: Evidence; note: string };
  deposit: { value: number | null; evidence: Evidence; note: string };
  escalation: { pct: number | null; evidence: Evidence; note: string };
  permittedUse: { value: string | null; evidence: Evidence; note: string };
  renewal: { value: string | null; evidence: Evidence; note: string };
  total: LeaseTotal;
  known: number;
  totalFields: number;
  evidence: Evidence;
  gaps: string[];
  /** Warnings a lessee should read before signing. Never a recommendation. */
  cautions: string[];
};

const LEASE_FIELDS = 5;

export function compareLease(terms: LeaseTerms): LeaseComparison {
  const total = leaseTotal(terms);

  const duration =
    terms.lease_months != null && terms.lease_months > 0
      ? {
          months: terms.lease_months,
          evidence: "CLAIM" as Evidence,
          note: "Stated by the owner or developer.",
        }
      : {
          months: null,
          evidence: "UNKNOWN" as Evidence,
          note: "Not stated by the owner or developer.",
        };
  const deposit =
    terms.deposit != null
      ? {
          value: terms.deposit,
          evidence: "CLAIM" as Evidence,
          note: "Stated by the owner or developer. Refundable subject to the agreement.",
        }
      : {
          value: null,
          evidence: "UNKNOWN" as Evidence,
          note: "Not stated by the owner or developer.",
        };
  const escalation =
    terms.escalation_pct != null
      ? {
          pct: terms.escalation_pct,
          evidence: "CLAIM" as Evidence,
          note: "Stated by the owner or developer. Confirm the clause wording in the agreement.",
        }
      : { pct: null, evidence: "UNKNOWN" as Evidence, note: "No escalation clause stated." };
  const permittedUse =
    terms.permitted_use != null
      ? {
          value: terms.permitted_use,
          evidence: "CLAIM" as Evidence,
          note: "Stated by the owner or developer. The registered agreement is what governs.",
        }
      : {
          value: null,
          evidence: "UNKNOWN" as Evidence,
          note: "Not stated by the owner or developer.",
        };
  const renewal =
    terms.renewal_terms != null
      ? {
          value: terms.renewal_terms,
          evidence: "CLAIM" as Evidence,
          note: "Stated by the owner or developer.",
        }
      : { value: null, evidence: "UNKNOWN" as Evidence, note: "No renewal right stated." };

  const gaps: string[] = [];
  if (duration.months == null) gaps.push("Lease duration");
  if (deposit.value == null) gaps.push("Deposit");
  if (escalation.pct == null) gaps.push("Escalation clause");
  if (permittedUse.value == null) gaps.push("Permitted use");
  if (renewal.value == null) gaps.push("Renewal terms");

  const cautions: string[] = [];
  if (escalation.pct == null)
    cautions.push(
      "No escalation clause is recorded. Ask what the rent becomes after the first year.",
    );
  if (renewal.value == null)
    cautions.push("No renewal right is recorded. Ask what happens at the end of the term.");
  if (terms.permitted_use != null && terms.permitted_use !== "residential") {
    cautions.push(
      `Permitted use is recorded as ${permittedUseLabel(terms.permitted_use)}. Check the use you intend is allowed.`,
    );
  }
  if (deposit.value == null)
    cautions.push(
      "The deposit is not stated. Establish the amount and the refund conditions before signing.",
    );

  const known = [
    duration.months,
    deposit.value,
    escalation.pct,
    permittedUse.value,
    renewal.value,
  ].filter((v) => v != null).length;

  return {
    duration,
    deposit,
    escalation,
    permittedUse,
    renewal,
    total,
    known,
    totalFields: LEASE_FIELDS,
    evidence: known === LEASE_FIELDS ? "CLAIM" : "UNKNOWN",
    gaps,
    cautions,
  };
}
