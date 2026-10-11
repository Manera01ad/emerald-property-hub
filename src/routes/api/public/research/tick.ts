import { createFileRoute } from "@tanstack/react-router";

/**
 * Called hourly by the database scheduler. The bearer token lives only in a private database table.
 * Every accepted call is logged in research_ticks; the database job sends X-PropWise-Origin: pg_cron,
 * so automatic runs can be told apart from manual calls to this address.
 */
export const Route = createFileRoute("/api/public/research/tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get("authorization") ?? "")?.[1];
        if (!token) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: ok } = await supabaseAdmin.rpc("verify_scheduler_token", { _token: token });
        if (!ok) return new Response("Unauthorized", { status: 401 });
        const origin = request.headers.get("x-propwise-origin") === "pg_cron" ? "pg_cron" : "manual_endpoint";
        const { data: tick } = await supabaseAdmin.from("research_ticks").insert({ origin }).select("id").single();
        const { runDueAgents } = await import("@/lib/research/engine.server");
        try {
          const results = await runDueAgents(supabaseAdmin, tick?.id ?? null);
          const ran = results.map((r) => ({ key: r.key, status: r.status, message: r.message }));
          if (tick) await supabaseAdmin.from("research_ticks").update({ finished_at: new Date().toISOString(), agents: ran }).eq("id", tick.id);
          return Response.json({ ok: true, tick: tick?.id, origin, ran });
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          if (tick) await supabaseAdmin.from("research_ticks").update({ finished_at: new Date().toISOString(), error }).eq("id", tick.id);
          return Response.json({ ok: false, error }, { status: 500 });
        }
      },
    },
  },
});
