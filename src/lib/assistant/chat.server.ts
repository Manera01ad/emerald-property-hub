import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./run-id";
import { ASSISTANT_INSTRUCTIONS } from "./instructions";
import { createAssistantTools, recordWebSearches, webSearchEnabled } from "./tools";
import { SKILLS } from "./skill-files";
import { withSkills } from "./skills";
import { DAILY_MESSAGE_LIMIT, LIMIT_REACHED_MESSAGE, MAX_HISTORY_MESSAGES, UNAVAILABLE_MESSAGE, checkMessage, windowStart } from "./limits";
import { buildUsageRecord } from "./cost";
import { ASSISTANT_MODEL_ID, AI_GATEWAY_URL, aiApiKey, aiProviderHeaders } from "./pricing";
import { reconcileBudget, refusalFor, reserveBudget } from "./budget.server";

const MODEL = ASSISTANT_MODEL_ID;
const GATEWAY = AI_GATEWAY_URL;

function json(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Client acting as the signed-in caller, so row-level security applies. */
function userClient(token: string) {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Backend not configured");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("apikey", key);
        headers.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export async function handleAssistantChat(request: Request): Promise<Response> {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json(401, "Please sign in to use the assistant.");
  const db = userClient(token);
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return json(401, "Please sign in to use the assistant.");
  const userId = auth.user.id;

  let messages: UIMessage[];
  try {
    const body = (await request.json()) as { messages?: unknown };
    if (!Array.isArray(body.messages) || body.messages.length === 0) throw new Error();
    messages = (body.messages as UIMessage[]).slice(-MAX_HISTORY_MESSAGES);
  } catch {
    return json(400, "Invalid request.");
  }

  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") return json(400, "Invalid request.");
  const problem = checkMessage(last);
  if (problem) return json(400, problem);

  // Daily allowance per user. A retry of the same message does not count twice.
  const { data: already } = await db.from("assistant_messages").select("id").eq("user_id", userId).eq("message_id", last.id).limit(1);
  if (!already?.length) {
    const { count, error: countError } = await db.from("assistant_messages").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("role", "user").gte("created_at", windowStart());
    if (countError) {
      console.error("assistant: counting messages failed", countError);
      return json(500, UNAVAILABLE_MESSAGE);
    }
    if ((count ?? 0) >= DAILY_MESSAGE_LIMIT) return json(429, LIMIT_REACHED_MESSAGE);
  }
  const { error: saveError } = await db.from("assistant_messages").upsert(
    { user_id: userId, message_id: last.id, role: "user", message: last as unknown as Json },
    { onConflict: "user_id,message_id", ignoreDuplicates: true },
  );
  if (saveError) {
    console.error("assistant: saving user message failed", saveError);
    return json(500, "Couldn't save your message. Please try again.");
  }

  const apiKey = aiApiKey();
  if (!apiKey) return json(500, "The assistant isn't configured yet.");

  // Global daily cap, checked before the paid call. The per-user limit above
  // bounds one person; this bounds the total bill. If the cap cannot be enforced
  // the call is refused, because the alternative is unbounded spend.
  const reservation = await reserveBudget(db, MODEL);
  if (!reservation.ok) {
    console.warn(`assistant: refused a call (${reservation.reason})`);
    return json(
      reservation.reason === "budget_exhausted" ? 429 : 503,
      refusalFor(reservation.reason),
    );
  }

  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: aiProviderHeaders(apiKey),
    fetch: runIdFetch.fetch,
  });

  // Every lookup is logged against the user's question, so they can review it under "Search history".
  const toolCtx = { db, userId, messageId: last.id };
  const webSearch = webSearchEnabled();
  const result = streamText({
    model: provider.responses(MODEL),
    system: withSkills(ASSISTANT_INSTRUCTIONS, SKILLS),
    messages: await convertToModelMessages(messages),
    tools: {
      ...createAssistantTools(toolCtx),
      ...(webSearch ? { web_search: provider.tools.webSearch({}) } : {}),
    },
    // One more step than before: loading a skill takes a step of its own before the lookups and the answer.
    stopWhen: stepCountIs(5),
    onStepFinish: (step) => recordWebSearches(toolCtx, step),
    // Reconcile the reservation with real usage. `usage` is aggregated across all
    // steps, and its token fields are optional: when the provider omits them,
    // buildUsageRecord falls back to the reservation amount and labels the row
    // `estimated` rather than inventing counts.
    onFinish: ({ usage }) => {
      const record = buildUsageRecord(MODEL, usage);
      void reconcileBudget(db, reservation.id, record);
    },
    abortSignal: request.signal,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        store: false,
      },
    },
  });

  const response = result.toUIMessageStreamResponse({
    originalMessages: messages,
    sendReasoning: false,
    onFinish: async ({ responseMessage, isAborted }) => {
      if (!responseMessage.parts.length) return;
      const { error } = await db.from("assistant_messages").upsert(
        {
          user_id: userId,
          message_id: responseMessage.id,
          role: "assistant",
          message: { ...responseMessage, metadata: { stopped: isAborted } } as unknown as Json,
        },
        { onConflict: "user_id,message_id" },
      );
      if (error) console.error("assistant: saving reply failed", error);
    },
    onError: (error) => {
      const status = (error as { statusCode?: number })?.statusCode;
      if (status === 402) { console.error("assistant: AI provider credits exhausted"); return UNAVAILABLE_MESSAGE; }
      if (status === 429) return "The assistant is busy right now. Please wait a moment and try again.";
      if (status === 403) return "The assistant isn't allowed to answer this request.";
      return "The assistant couldn't answer just now. Please try again.";
    },
  });
  return withLovableAiGatewayRunIdHeader(response, runIdFetch);
}
