/** Pure rules for owner submissions and moderation. No I/O here, so they stay testable. */

export const DECLARATION_VERSION = "owner-declaration-2026-03";

/**
 * The declaration an owner or developer accepts before a submission is accepted.
 * It is stored word for word with the submission, so we can always show what was agreed.
 */
export const DECLARATION_TEXT =
  "I am the owner of this property, or I am authorised by the owner to list it. The details I have given are true to the best of my knowledge. " +
  "I give PropWise AI permission to publish this listing, and I understand it will be reviewed before it appears. " +
  "I understand PropWise does not pay for listings, does not take a commission, and does not guarantee a sale.";

export type SubmissionStatus = "submitted" | "in_review" | "approved" | "needs_changes" | "rejected";

export const SUBMISSION_STATUSES: SubmissionStatus[] = ["submitted", "in_review", "approved", "needs_changes", "rejected"];

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  submitted: "Submitted",
  in_review: "In review",
  approved: "Approved",
  needs_changes: "Needs changes",
  rejected: "Rejected",
};

export type SubmitInput = {
  submitterKind: "owner" | "developer";
  name: string;
  phone: string;
  email: string;
  reraNumber: string;
  localitySlug: string;
  propertyType: string;
  transactionType: string;
  bedrooms: string;
  builtArea: string;
  landArea: string;
  askingPrice: string;
  // Rent terms. Only meaningful when transactionType is 'rent'.
  deposit: string;
  maintenanceMonthly: string;
  furnishing: string;
  availableFrom: string;
  // Lease terms. Only meaningful when transactionType is 'lease'.
  leaseMonths: string;
  escalationPct: string;
  permittedUse: string;
  renewalTerms: string;
  description: string;
  declared: boolean;
  honeypot: string;
};

export type ValidationResult = { ok: true } | { ok: false; errors: Record<string, string> };

const PHONE = /^[+0-9 ()-]{6,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROPERTY_TYPES = ["villa", "independent_house", "resale_home", "apartment", "plot"];
const TRANSACTION_TYPES = ["buy", "rent", "lease"];
const FURNISHING = ["unfurnished", "semi_furnished", "fully_furnished"];
const PERMITTED_USES = ["residential", "commercial", "office", "retail", "industrial", "mixed"];
const RENEWAL = ["renewable", "not_renewable", "by_agreement"];

function positiveNumber(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Zero is a valid deposit or escalation; a blank is not the same as zero. */
function nonNegativeNumber(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Every rule the form enforces, in one place, so the form and its tests agree. */
export function validateSubmission(input: SubmitInput): ValidationResult {
  const errors: Record<string, string> = {};
  if (input.honeypot.trim()) errors["honeypot"] = "Submission rejected.";
  if (!input.name.trim()) errors["name"] = "Your name is required.";
  if (!PHONE.test(input.phone.trim())) errors["phone"] = "Enter a phone number we can reach you on.";
  if (!EMAIL.test(input.email.trim())) errors["email"] = "A verified email address is required.";
  if (input.submitterKind === "developer" && input.reraNumber.trim().length < 6) {
    errors["reraNumber"] = "Developers must give their TNRERA registration number.";
  }
  if (!input.localitySlug.trim()) errors["localitySlug"] = "Choose the locality from the list.";
  if (!PROPERTY_TYPES.includes(input.propertyType)) errors["propertyType"] = "Choose a property type.";
  if (!TRANSACTION_TYPES.includes(input.transactionType)) errors["transactionType"] = "Choose buy, rent or lease.";
  // A plot is land for sale; it is not rented or leased as a home.
  if (input.transactionType !== "buy" && input.propertyType === "plot") {
    errors["transactionType"] = "A plot can only be listed for sale.";
  }
  const bedrooms = input.bedrooms.trim() === "" ? null : Number(input.bedrooms);
  if (bedrooms != null && (!Number.isInteger(bedrooms) || bedrooms < 0)) errors["bedrooms"] = "Bedrooms must be a whole number.";
  for (const [key, label] of [["builtArea", "Built area"], ["landArea", "Land area"], ["askingPrice", "Monthly rent"]] as const) {
    const raw = input[key];
    if (raw.trim() && positiveNumber(raw) == null) errors[key] = `${label} must be a positive number.`;
  }

  if (input.transactionType === "rent" || input.transactionType === "lease") {
    // The monthly figure is the one number a tenant or lessee cannot do without.
    if (!input.askingPrice.trim()) errors["askingPrice"] = "State the monthly rent.";
    if (input.deposit.trim() && nonNegativeNumber(input.deposit) == null) errors["deposit"] = "Deposit must be zero or more.";
    if (input.maintenanceMonthly.trim() && nonNegativeNumber(input.maintenanceMonthly) == null) {
      errors["maintenanceMonthly"] = "Maintenance must be zero or more.";
    }
    if (input.furnishing.trim() && !FURNISHING.includes(input.furnishing)) errors["furnishing"] = "Choose a furnishing state.";
  }

  if (input.transactionType === "lease") {
    const months = input.leaseMonths.trim() === "" ? null : Number(input.leaseMonths);
    if (months == null || !Number.isInteger(months) || months <= 0) errors["leaseMonths"] = "State the lease duration in whole months.";
    if (input.escalationPct.trim() && nonNegativeNumber(input.escalationPct) == null) errors["escalationPct"] = "Escalation must be zero or more.";
    if (input.permittedUse.trim() && !PERMITTED_USES.includes(input.permittedUse)) errors["permittedUse"] = "Choose the permitted use.";
    if (input.renewalTerms.trim() && !RENEWAL.includes(input.renewalTerms)) errors["renewalTerms"] = "Choose the renewal position.";
  }

  if (input.description.length > 2000) errors["description"] = "Keep the description under 2000 characters.";
  if (!input.declared) errors["declared"] = "Please accept the declaration.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true };
}

/** Which moderation moves are offered next. Mirrors the database transition trigger. */
export function nextStatuses(status: SubmissionStatus): SubmissionStatus[] {
  if (status === "submitted") return ["in_review", "approved", "needs_changes", "rejected"];
  if (status === "in_review") return ["approved", "needs_changes", "rejected"];
  if (status === "needs_changes") return ["in_review", "rejected"];
  return [];
}

export function statusTone(status: SubmissionStatus): string {
  if (status === "approved") return "bg-secondary text-success";
  if (status === "rejected") return "bg-destructive/10 text-destructive";
  if (status === "needs_changes") return "bg-warning-soft text-warning";
  return "bg-muted text-muted-foreground";
}

export function canSubmitToday(createdAtIso: string[], now = new Date()): boolean {
  const cutoff = now.getTime() - 24 * 60 * 60 * 1000;
  return createdAtIso.filter((d) => new Date(d).getTime() > cutoff).length < 3;
}

export function canOpenAnother(statuses: SubmissionStatus[]): boolean {
  return statuses.filter((s) => s === "submitted" || s === "in_review" || s === "needs_changes").length < 3;
}
