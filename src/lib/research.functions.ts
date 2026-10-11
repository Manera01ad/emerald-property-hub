import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KEYS = ["discovery", "price_monitor", "quality", "deal_analysis", "location", "infrastructure"] as const;

/** Admin-only: run one agent now (Run now / Retry), or the whole pipeline. */
export const runResearchAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.enum([...KEYS, "all"]), trigger: z.enum(["manual", "retry"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Admins only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runAgent, AGENT_KEYS } = await import("@/lib/research/engine.server");
    const keys = data.key === "all" ? AGENT_KEYS : [data.key];
    const results = [];
    for (const k of keys) results.push(await runAgent(supabaseAdmin, k, data.trigger));
    return results;
  });
