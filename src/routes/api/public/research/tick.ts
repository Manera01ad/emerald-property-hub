import { createFileRoute } from "@tanstack/react-router";

/** Called hourly by the database scheduler. The bearer token lives only in a private database table. */
export const Route = createFileRoute("/api/public/research/tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get("authorization") ?? "")?.[1];
        if (!token) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: ok } = await supabaseAdmin.rpc("verify_scheduler_token", { _token: token });
        if (!ok) return new Response("Unauthorized", { status: 401 });
        const { runDueAgents } = await import("@/lib/research/engine.server");
        const results = await runDueAgents(supabaseAdmin);
        return Response.json({ ok: true, ran: results.map((r) => ({ key: r.key, status: r.status })) });
      },
    },
  },
});
