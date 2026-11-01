/**
 * Admin-only AI spend, for the control centre.
 *
 * A server function rather than a direct table read, for two reasons. The rows
 * carry business cost information, so they should not reach a browser at all —
 * this returns only the aggregate the screen needs, plus a short list of recent
 * calls. And the admin check runs here, where it cannot be skipped, instead of
 * relying on the caller to be trustworthy.
 *
 * The table names are not in the generated database types yet because the
 * migration is still pending, so the cast inside `fetchAiSpend` bridges that.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dailyBudgetInr } from "@/lib/assistant/budget";
import { fetchAiSpend, summariseSpend, type SpendSummary, type UsageRow } from "@/lib/ai-costs";

export type AiCostReport = {
  /** False when the migration has not been applied, so nothing can be measured. */
  enforcementAvailable: boolean;
  /** The cap the code will enforce, before the owner's stored override. */
  configuredBudgetInr: number;
  summary: SpendSummary;
  recent: UsageRow[];
};

export const getAiCostReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AiCostReport> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admins only");

    const configuredBudgetInr = dailyBudgetInr();

    try {
      const { usage, ledger } = await fetchAiSpend(context.supabase);
      return {
        enforcementAvailable: true,
        configuredBudgetInr,
        summary: summariseSpend(usage, ledger),
        recent: usage.slice(0, 20),
      };
    } catch (error) {
      // A missing table means the migration is not applied, which is the state
      // where the assistant refuses paid calls. Reporting zeros here would read
      // as "nothing spent" when the truth is "nothing measurable".
      console.warn("ai costs: unable to read usage", error);
      return {
        enforcementAvailable: false,
        configuredBudgetInr,
        summary: { spentInr: 0, reservedInr: 0, calls: 0, estimated: 0, unpriced: 0 },
        recent: [],
      };
    }
  });
