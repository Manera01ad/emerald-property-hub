/**
 * Regression tests for the assistant's refusal path.
 *
 * The defect guarded here: a refused call used to persist the user's question
 * *before* asking for budget, so a refused call charged the 15-per-day allowance
 * for an answer that was never produced. During an outage — for example the
 * unmigrated `reserve_ai_budget` function, which is the current production state
 * per docs/CURRENT_STATE.md §4.1 — the fifteenth refusal turned a truthful 503
 * into a false "you have reached today's limit", and the stored rows kept the
 * user out for up to a day after the outage ended.
 *
 * Nothing here spends money or touches a network: the Supabase client is a fake
 * and the AI SDK is stubbed, so no provider request can be made. The transport is
 * replaced; the ordering and status mapping under test are the real code.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Upsert = { table: string; row: Record<string, unknown> };

type FakeState = {
  already: { id: string }[];
  count: number;
  upserts: Upsert[];
  rpcResult: { data: unknown; error: { message: string } | null };
};

type Builder = {
  select: (...args: unknown[]) => Builder;
  eq: (...args: unknown[]) => Builder;
  gte: (...args: unknown[]) => Builder;
  limit: (...args: unknown[]) => Promise<{ data: { id: string }[]; error: null }>;
  upsert: (...args: unknown[]) => Promise<{ error: null }>;
  insert: (...args: unknown[]) => Promise<{ error: null }>;
  then: (
    onFulfilled?: (value: { count: number; error: null }) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
};

// The factory runs lazily, so it may only touch globals — never test-module state.
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => (globalThis as unknown as { __PW_DB__?: unknown }).__PW_DB__,
}));

// A stub that would report the defect loudly if a paid call were ever reached
// on a refusal path: toUIMessageStreamResponse is only used by the granted case.
vi.mock("ai", () => ({
  streamText: () => ({
    toUIMessageStreamResponse: () => new Response("{}", { status: 200 }),
  }),
  convertToModelMessages: async (messages: unknown) => messages,
  stepCountIs: () => () => true,
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: () => ({ responses: () => ({}), tools: { webSearch: () => ({}) } }),
}));

vi.mock("./tools", () => ({
  createAssistantTools: () => ({}),
  recordWebSearches: () => {},
  webSearchEnabled: () => false,
}));

vi.mock("./skill-files", () => ({ SKILLS: [], SKILL_ERRORS: [] }));

import { handleAssistantChat } from "./chat.server";

const MISSING_FUNCTION = {
  data: null,
  error: {
    message:
      "Could not find the function public.reserve_ai_budget(_daily_budget_inr, _reservation_inr, _timezone) in the schema cache",
  },
};

function makeDb(state: FakeState) {
  const builder = (table: string): Builder => {
    const b: Builder = {
      select: () => b,
      eq: () => b,
      gte: () => b,
      limit: () => Promise.resolve({ data: state.already, error: null }),
      upsert: (row: unknown) => {
        state.upserts.push({ table, row: row as Record<string, unknown> });
        return Promise.resolve({ error: null });
      },
      insert: (row: unknown) => {
        state.upserts.push({ table, row: row as Record<string, unknown> });
        return Promise.resolve({ error: null });
      },
      // The daily-limit query is awaited directly, so the builder is thenable.
      then: (onFulfilled, onRejected) =>
        Promise.resolve({ count: state.count, error: null }).then(onFulfilled, onRejected),
    };
    return b;
  };

  return {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) },
    from: (table: string) => builder(table),
    rpc: async () => state.rpcResult,
  };
}

function request(): Request {
  return new Request("http://localhost/api/assistant", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer test-session",
      // Keeps the streaming wrapper from waiting on a provider header that the
      // stubbed model never sends.
      "x-lovable-aig-run-id": "test-run",
    },
    body: JSON.stringify({
      messages: [
        {
          id: "msg-1",
          role: "user",
          parts: [{ type: "text", text: "Is Potheri good for a family?" }],
        },
      ],
    }),
  });
}

let state: FakeState;

beforeEach(() => {
  state = {
    already: [],
    count: 0,
    upserts: [],
    rpcResult: MISSING_FUNCTION,
  };
  (globalThis as unknown as { __PW_DB__?: unknown }).__PW_DB__ = makeDb(state);
  // Dummy values only; no real secret is read or sent anywhere.
  vi.stubEnv("SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
  vi.stubEnv("AI_API_KEY", "test-key-not-real");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("handleAssistantChat refusals", () => {
  it("refuses with 503 and records nothing when the budget function is missing", async () => {
    const response = await handleAssistantChat(request());

    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/unavailable right now/i);
    // The question was never answered, so it must not be stored against the user.
    expect(state.upserts).toHaveLength(0);
  });

  it("does not turn an outage into a false daily-limit refusal", async () => {
    const statuses: number[] = [];

    for (let attempt = 0; attempt < 16; attempt += 1) {
      // Exactly what the count query would return: one row per stored question.
      state.count = state.upserts.length;
      const response = await handleAssistantChat(request());
      statuses.push(response.status);
    }

    // 16 truthful "unavailable" answers, not 15 then a misleading 429.
    expect(statuses).toEqual(new Array<number>(16).fill(503));
    expect(state.upserts).toHaveLength(0);
  });

  it("keeps a genuine cap at 429 and still records nothing", async () => {
    state.rpcResult = {
      data: [
        { allowed: false, reservation_inr: 0.4, reservation_id: null, reason: "budget_exhausted" },
      ],
      error: null,
    };

    const response = await handleAssistantChat(request());

    expect(response.status).toBe(429);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/today's usage limit/i);
    expect(state.upserts).toHaveLength(0);
  });

  it("does not record the question when the assistant is not configured", async () => {
    vi.stubEnv("AI_API_KEY", "");
    vi.stubEnv("LOVABLE_API_KEY", "");

    const response = await handleAssistantChat(request());

    expect(response.status).toBe(500);
    expect(state.upserts).toHaveLength(0);
  });

  it("records the question once a reservation is granted", async () => {
    state.rpcResult = {
      data: [{ allowed: true, reservation_inr: 0.4, reservation_id: "res-1", reason: null }],
      error: null,
    };

    const response = await handleAssistantChat(request());

    expect(response.status).toBe(200);
    expect(state.upserts).toHaveLength(1);
    expect(state.upserts[0]?.table).toBe("assistant_messages");
  });
});
