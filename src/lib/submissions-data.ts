import { supabase } from "@/integrations/supabase/client";
import type { SubmissionStatus } from "./submissions";

/**
 * listing_submissions is created by migration 0016 and is not in the generated database
 * types yet, and the generated types file is owner-only. This narrow shape reaches the
 * table without editing it or casting to any.
 */
export type Submission = {
  id: string;
  submitter_id: string;
  submitter_kind: "owner" | "developer";
  submitter_name: string;
  contact_phone: string;
  contact_email: string;
  rera_number: string | null;
  locality_slug: string;
  property_type: string;
  transaction_type: string;
  bedrooms: number | null;
  built_area_sqft: number | null;
  land_area_sqft: number | null;
  asking_price: number | null;
  deposit: number | null;
  maintenance_monthly: number | null;
  furnishing: string | null;
  available_from: string | null;
  lease_months: number | null;
  escalation_pct: number | null;
  permitted_use: string | null;
  renewal_terms: string | null;
  description: string | null;
  declaration_version: string;
  declared_at: string;
  declaration_text: string;
  status: SubmissionStatus;
  review_reason: string | null;
  reviewed_at: string | null;
  created_property_id: string | null;
  created_at: string;
};

type Result = { data: unknown; error: { message: string } | null };
type Query = PromiseLike<Result> & { order: (column: string, opts?: { ascending?: boolean }) => Query; eq: (column: string, value: unknown) => Query };
type Table = { select: (columns?: string) => Query; update: (patch: Record<string, unknown>) => Query; insert: (row: Record<string, unknown>) => PromiseLike<Result> };
type Db = {
  from: (table: "listing_submissions") => Table;
  rpc: (fn: "approve_listing_submission", args: Record<string, unknown>) => PromiseLike<Result>;
};

const db = () => supabase as unknown as Db;

/** A new submission. The status, reviewer fields and limits are set by the database, not the client. */
export async function createSubmission(row: Record<string, unknown>): Promise<void> {
  const { error } = await db().from("listing_submissions").insert(row);
  if (error) throw new Error(error.message);
}

export async function listSubmissions(): Promise<Submission[]> {
  const { data, error } = await db().from("listing_submissions").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Submission[];
}

/** The signed-in user's own submissions. Row-level security returns only their rows. */
export async function mySubmissions(): Promise<Submission[]> {
  return listSubmissions();
}

/** Only an admin can change a status; the database rejects anyone else. */
export async function setSubmissionStatus(id: string, status: SubmissionStatus, reason: string | null): Promise<void> {
  const { error } = await db().from("listing_submissions").update({ status, review_reason: reason }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Creates the draft property row and marks the submission approved, in one transaction. */
export async function approveSubmission(id: string, title: string, reason: string | null): Promise<string> {
  const { data, error } = await db().rpc("approve_listing_submission", {
    _submission_id: id,
    _title: title,
    _reason: reason,
  });
  if (error) throw new Error(error.message);
  return String(data);
}
