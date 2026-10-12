import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_my_research",
  title: "Get my property research",
  description: "Get the signed-in user's saved buyer/renter preferences and their saved reports.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    const [prof, reps] = await Promise.all([
      sb.from("buyer_profiles").select("*").eq("user_id", userId).maybeSingle(),
      sb.from("buyer_reports").select("id,kind,title,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    ]);
    if (prof.error) throw new ToolError(prof.error.message);
    if (reps.error) throw new ToolError(reps.error.message);
    const result = { profile: prof.data ?? null, reports: reps.data ?? [] };
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
});
