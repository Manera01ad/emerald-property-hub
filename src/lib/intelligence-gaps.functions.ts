/**
 * The Intelligence Gap Dashboard's data, admin-only.
 *
 * Why this reads with the service-role client: the search log's row-level
 * security lets a user see only their own rows, so a per-user client could never
 * see demand across everyone. Reading with the service role is therefore
 * necessary — and it is exactly why the admin check below is not optional, and
 * why only aggregated counts leave this function.
 *
 * What leaves: counts, dates, a subject line and a proposed next step. What does
 * not: user ids, message ids and raw query text beyond the term used to group.
 * `collectGaps` is what enforces that, and it is tested against a row carrying a
 * user id.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  collectGaps,
  summariseGaps,
  type KnowledgeGap,
  type SearchSignal,
} from "@/lib/intelligence-gaps";

export type IntelligenceGapReport = {
  gaps: KnowledgeGap[];
  summary: string;
  /** How many signals were analysed, so the panel can say how thin the evidence is. */
  signalsRead: number;
  /** True when the log could not be read, which is different from "no gaps". */
  readFailed: boolean;
};

/** Only the most recent window is analysed, so the query stays bounded. */
const WINDOW_DAYS = 30;
const MAX_ROWS = 2000;

export const getIntelligenceGaps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IntelligenceGapReport> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admins only");

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabaseAdmin
        .from("assistant_search_log")
        .select("kind, query, result_count, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(MAX_ROWS);
      if (error) throw new Error(error.message);

      // user_id is never selected, so it cannot leak into the aggregation.
      const signals: SearchSignal[] = (data ?? []).map((row) => ({
        kind: row.kind,
        query: (row.query ?? {}) as Record<string, unknown>,
        resultCount: row.result_count,
        createdAt: row.created_at,
      }));

      const gaps = collectGaps(signals);
      return { gaps, summary: summariseGaps(gaps), signalsRead: signals.length, readFailed: false };
    } catch (error) {
      // An unreadable log is not the same as no gaps, and the panel must say so.
      console.warn("intelligence gaps: could not read the search log", error);
      return {
        gaps: [],
        summary: "The search log could not be read.",
        signalsRead: 0,
        readFailed: true,
      };
    }
  });
