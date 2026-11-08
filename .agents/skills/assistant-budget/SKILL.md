---
name: assistant-budget
description: Use when changing the help assistant, /api/assistant, AI provider configuration, cost guards, daily allowances, or chat persistence.
---

# Assistant and budget

## Flow

`/api/assistant` (`src/routes/api/assistant.ts`) verifies the caller's token, then
`src/lib/assistant/chat.server.ts` streams the reply. AI keys stay server-side and
never reach the browser.

Conversations are saved under RLS, so a user reads only their own chats.

## Modules

| File | Responsibility |
| --- | --- |
| `src/lib/assistant/chat.server.ts` | request handling, provider call, run-id header |
| `src/lib/assistant/entry.ts` | entry and request validation |
| `src/lib/assistant/budget.ts` + `budget.server.ts` | daily allowance, pure and server halves |
| `src/lib/assistant/limits.ts` | per-message and rate limits |
| `src/lib/assistant/pricing.ts`, `cost.ts`, `src/lib/ai-costs.ts` | price table and cost maths |
| `src/lib/assistant/tools.ts`, `skills.ts` | tool definitions and product skill loading |
| `src/lib/assistant/search-log.ts` | search logging |
| `src/lib/assistant/skills/` | **product** skill content for the assistant, unrelated to `.agents/skills/` |

## Provider configuration

The default gateway is Lovable's (`https://ai.gateway.lovable.dev/v1`), chosen in
`src/lib/assistant/pricing.ts`. It is configuration-overridable: set `AI_BASE_URL`
and `AI_API_KEY`. The neutral names are preferred; `LOVABLE_API_KEY` is a legacy
fallback. Lovable-specific headers are sent only when the host is
`gateway.lovable.dev`.

Do not raise allowances or limits, or switch to a paid provider, without the
owner's explicit approval. Every message spends money.

## Tests

Colocated: `budget.test.ts`, `budget.server.test.ts`, `cost.test.ts`,
`limits.test.ts`, `pricing.test.ts`, `entry.test.ts`, `search-log.test.ts`,
`skills.test.ts`, `skill-content.test.ts`, `flood-evidence.test.ts`.
