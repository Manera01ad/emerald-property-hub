/**
 * Local Research Network rules. Pure, so they can be tested without a database.
 *
 * The network exists because verifying a locality needs local knowledge, and hiring a team for
 * every locality within 400 km of Chennai does not scale. Contributors supply the facts; the
 * rules here keep what they supply usable: every task names the field it is evidence for and
 * the source it expects, every submission is reviewed by someone else, and recognition is
 * points, never money.
 *
 * Nothing here reads or writes. The database enforces the same rules, so a client that skips
 * this module still cannot break them.
 */

import type { Evidence } from "./evidence";

export const CONTRIBUTOR_RELATIONSHIPS = [
  "resident",
  "owner",
  "tenant",
  "lessee",
  "agent",
  "developer",
  "other",
] as const;
export type ContributorRelationship = (typeof CONTRIBUTOR_RELATIONSHIPS)[number];

export const RELATIONSHIP_LABELS: Record<ContributorRelationship, string> = {
  resident: "Resident",
  owner: "Owner",
  tenant: "Tenant",
  lessee: "Lessee",
  agent: "Agent",
  developer: "Developer",
  other: "Other",
};

export const CONTRIBUTOR_STATUSES = ["pending", "active", "paused", "removed"] as const;
export type ContributorStatus = (typeof CONTRIBUTOR_STATUSES)[number];

export const DIFFICULTIES = ["easy", "moderate", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Quick",
  moderate: "Moderate",
  hard: "Involved",
};

export const TASK_STATUSES = ["draft", "open", "closed", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const SUBMISSION_STATUSES = [
  "submitted",
  "in_review",
  "accepted",
  "needs_changes",
  "rejected",
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  submitted: "Submitted",
  in_review: "In review",
  accepted: "Accepted",
  needs_changes: "Needs changes",
  rejected: "Rejected",
};

/** What an answer becomes evidence for. Each maps to a field the locality page can show. */
export const EVIDENCE_FIELDS = [
  "water_supply",
  "power_reliability",
  "flood_risk",
  "traffic_peak",
  "drainage",
  "road_condition",
  "school_proximity",
  "hospital_proximity",
  "transit_proximity",
  "market_proximity",
  "construction_quality",
  "noise_level",
  "air_quality",
  "civic_services",
  "rent_range",
  "lease_terms",
  "sale_price_range",
  "occupancy",
  "other",
] as const;
export type EvidenceField = (typeof EVIDENCE_FIELDS)[number];

export const EVIDENCE_FIELD_LABELS: Record<EvidenceField, string> = {
  water_supply: "Water supply",
  power_reliability: "Power reliability",
  flood_risk: "Flood risk",
  traffic_peak: "Peak-hour traffic",
  drainage: "Drainage",
  road_condition: "Road condition",
  school_proximity: "Schools nearby",
  hospital_proximity: "Hospitals nearby",
  transit_proximity: "Public transport",
  market_proximity: "Markets nearby",
  construction_quality: "Construction quality",
  noise_level: "Noise",
  air_quality: "Air quality",
  civic_services: "Civic services",
  rent_range: "Rent range",
  lease_terms: "Lease terms",
  sale_price_range: "Sale price range",
  occupancy: "Occupancy",
  other: "Other",
};

export function evidenceFieldLabel(value: string | null | undefined): string {
  return (EVIDENCE_FIELDS as readonly string[]).includes(value ?? "")
    ? EVIDENCE_FIELD_LABELS[value as EvidenceField]
    : "Not recorded";
}

/** How many points a task is worth, by difficulty and how many answers it needs. */
const BASE_POINTS: Record<Difficulty, number> = { easy: 10, moderate: 25, hard: 50 };

export function pointsFor(difficulty: Difficulty, requiredSubmissions = 1): number {
  const base = BASE_POINTS[difficulty] ?? BASE_POINTS.easy;
  // A task needing several independent answers is worth proportionally more.
  return base * Math.max(1, Math.min(10, requiredSubmissions));
}

export type TaskDraft = {
  localitySlug: string;
  title: string;
  ask: string;
  evidenceField: string;
  expectedSource: string;
  difficulty: string;
  requiredSubmissions: number;
};

export type TaskValidation = { ok: true } | { ok: false; errors: Record<string, string> };

/**
 * The gate a task passes before it can be published. The point is that a task cannot ask for
 * an opinion: it must name the field the answer becomes evidence for and the source it expects.
 */
export function validateTask(draft: TaskDraft): TaskValidation {
  const errors: Record<string, string> = {};
  if (!draft.localitySlug.trim()) errors["localitySlug"] = "Choose a locality from the list.";
  if (draft.title.trim().length < 8)
    errors["title"] = "Give the task a clear title of at least eight characters.";
  if (draft.ask.trim().length < 20)
    errors["ask"] = "Describe exactly what is needed, in at least twenty characters.";
  if (!(EVIDENCE_FIELDS as readonly string[]).includes(draft.evidenceField)) {
    errors["evidenceField"] = "Say which piece of evidence this task produces.";
  }
  if (draft.expectedSource.trim().length < 5) {
    errors["expectedSource"] =
      "Name where the answer should come from, for example the local municipal office.";
  }
  if (!(DIFFICULTIES as readonly string[]).includes(draft.difficulty))
    errors["difficulty"] = "Choose a difficulty.";
  const n = Number(draft.requiredSubmissions);
  if (!Number.isInteger(n) || n < 1 || n > 10)
    errors["requiredSubmissions"] = "Ask for between one and ten answers.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true };
}

/** Whether a task is still worth showing: open, and not past its expiry. */
export function isTaskOpen(
  task: { status: string; expires_at?: string | null },
  now = new Date(),
): boolean {
  if (task.status !== "open") return false;
  if (!task.expires_at) return true;
  return new Date(task.expires_at).getTime() > now.getTime();
}

/** How many accepted answers are still needed. */
export function answersNeeded(task: {
  required_submissions: number;
  accepted_submissions: number;
}): number {
  return Math.max(0, task.required_submissions - task.accepted_submissions);
}

export type TaskProgress = {
  needed: number;
  done: boolean;
  /** A task with all its answers is closed; one still waiting is not shown as complete. */
  label: string;
};

export function taskProgress(task: {
  required_submissions: number;
  accepted_submissions: number;
}): TaskProgress {
  const needed = answersNeeded(task);
  return {
    needed,
    done: needed === 0,
    label: needed === 0 ? "Filled" : `${needed} more ${needed === 1 ? "answer" : "answers"} needed`,
  };
}

/** The submission states a contributor can move to, mirroring the database transitions. */
export function nextSubmissionStatuses(status: SubmissionStatus): SubmissionStatus[] {
  if (status === "submitted") return ["in_review", "accepted", "needs_changes", "rejected"];
  if (status === "in_review") return ["accepted", "needs_changes", "rejected"];
  if (status === "needs_changes") return ["in_review", "rejected"];
  return [];
}

export function submissionStatusTone(status: SubmissionStatus): string {
  if (status === "accepted") return "bg-secondary text-success";
  if (status === "rejected") return "bg-destructive/10 text-destructive";
  if (status === "needs_changes") return "bg-warning-soft text-warning";
  return "bg-muted text-muted-foreground";
}

/**
 * What a reviewed submission is worth as evidence on a locality page.
 *
 * An accepted answer is a CLAIM, never VERIFIED: a person told us, and a reviewer checked it
 * is attributable, but we did not measure it ourselves. VERIFIED is reserved for a figure we
 * hold from an official source. Anything not accepted contributes nothing at all.
 */
export function evidenceForSubmission(status: SubmissionStatus): Evidence {
  return status === "accepted" ? "CLAIM" : "UNKNOWN";
}

/** Whether a submission needs a source before a reviewer can accept it. */
export function requiresSource(evidenceField: string): boolean {
  // A rent or price range is an observation of what is being asked locally; it is still a
  // claim, but it is the kind of thing a contributor may reasonably report without a link.
  return ![
    "rent_range",
    "lease_terms",
    "sale_price_range",
    "occupancy",
    "noise_level",
    "air_quality",
  ].includes(evidenceField);
}

export type SubmissionDraft = {
  body: string;
  sourceUrl: string;
  observedOn: string;
  evidenceField: string;
};

export function validateSubmission(draft: SubmissionDraft): TaskValidation {
  const errors: Record<string, string> = {};
  if (draft.body.trim().length < 20)
    errors["body"] = "Describe what you found, in at least twenty characters.";
  if (draft.body.length > 2000) errors["body"] = "Keep it under 2000 characters.";
  if (draft.sourceUrl.trim() && !/^https?:\/\/\S+$/i.test(draft.sourceUrl.trim())) {
    errors["sourceUrl"] = "A source must be a web link starting with http.";
  }
  if (requiresSource(draft.evidenceField) && !draft.sourceUrl.trim()) {
    errors["sourceUrl"] = "This task asks for a source, so a link is required.";
  }
  if (draft.observedOn.trim() && Number.isNaN(new Date(draft.observedOn).getTime())) {
    errors["observedOn"] = "Give the date you observed this.";
  }
  // A future observation date means the date is wrong, so it is refused rather than stored.
  if (draft.observedOn.trim() && new Date(draft.observedOn).getTime() > Date.now() + 86_400_000) {
    errors["observedOn"] = "The observation date cannot be in the future.";
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true };
}

/**
 * Whether a contributor can take on more work. Active and paused accounts may submit; a
 * pending account must be reviewed first, so an unvetted person cannot fill a task.
 */
export function canSubmitFor(status: ContributorStatus): boolean {
  return status === "active";
}

/** Points are recognition only. This is the sentence shown wherever points appear. */
export const POINTS_DISCLAIMER =
  "Points recognise local knowledge. They are not money, cannot be exchanged for money, and give no advantage in listings or search.";

/** The most a contributor may submit in a day, matching the database trigger. */
export const DAILY_SUBMISSION_LIMIT = 5;

export function canSubmitToday(createdAtIso: string[], now = new Date()): boolean {
  const cutoff = now.getTime() - 24 * 60 * 60 * 1000;
  return createdAtIso.filter((d) => new Date(d).getTime() > cutoff).length < DAILY_SUBMISSION_LIMIT;
}

/** A contributor's standing, in words. Deliberately not a public score. */
export function contributorStanding(approved: number, rejected: number): string {
  if (approved === 0 && rejected === 0) return "No contributions reviewed yet";
  if (rejected > approved) return "More contributions rejected than accepted";
  if (approved >= 20) return "Trusted local contributor";
  if (approved >= 5) return "Established contributor";
  return "New contributor";
}
