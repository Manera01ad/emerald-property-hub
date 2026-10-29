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
  bedrooms: string;
  builtArea: string;
  landArea: string;
  askingPrice: string;
  description: string;
  declared: boolean;
  honeypot: string;
};

export type ValidationResult = { ok: true } | { ok: false; errors: Record<string, string> };

const PHONE = /^[+0-9 ()-]{6,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROPERTY_TYPES = ["villa", "independent_house", "resale_home", "apartment", "plot"];

function positiveNumber(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
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
  const bedrooms = input.bedrooms.trim() === "" ? null : Number(input.bedrooms);
  if (bedrooms != null && (!Number.isInteger(bedrooms) || bedrooms < 0)) errors["bedrooms"] = "Bedrooms must be a whole number.";
  for (const [key, label] of [["builtArea", "Built area"], ["landArea", "Land area"], ["askingPrice", "Asking price"]] as const) {
    const raw = input[key];
    if (raw.trim() && positiveNumber(raw) == null) errors[key] = `${label} must be a positive number.`;
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
