import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./run-id";
import { ASSISTANT_INSTRUCTIONS } from "./instructions";

const MODEL = "openai/gpt-6-astra";
const GATEWAY = "https://ai.gateway.lovable.dev/v1";

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
    messages = (body.messages as UIMessage[]).slice(-40);
  } catch {
    return json(400, "Invalid request.");
  }

  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") return json(400, "Invalid request.");
  const { error: saveError } = await db.from("assistant_messages").upsert(
    { user_id: userId, message_id: last.id, role: "user", message: last as unknown as Json },
    { onConflict: "user_id,message_id", ignoreDuplicates: true },
  );
  if (saveError) {
    console.error("assistant: saving user message failed", saveError);
    return json(500, "Couldn't save your message. Please try again.");
  }

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return json(500, "The assistant isn't configured yet.");
  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const result = streamText({
    model: provider.responses(MODEL),
    system: ASSISTANT_INSTRUCTIONS,
    messages: await convertToModelMessages(messages),
    abortSignal: request.signal,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  const response = result.toUIMessageStreamResponse({
    originalMessages: messages,
    sendReasoning: true,
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
      if (status === 402) return "Lovable AI credits have run out. The site owner needs to top up in Settings → Plans & credits.";
      if (status === 429) return "The assistant is busy right now. Please wait a moment and try again.";
      if (status === 403) return "The assistant isn't allowed to answer this request.";
      return "The assistant couldn't answer just now. Please try again.";
    },
  });
  return withLovableAiGatewayRunIdHeader(response, runIdFetch);
}
