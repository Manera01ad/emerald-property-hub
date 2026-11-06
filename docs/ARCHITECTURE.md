# Architecture

Companion to `docs/PLAN.md`. What the system is made of, and how each piece
changes when it leaves Lovable. Read `docs/DATA_FLOW.md` for the data detail and
`docs/audit-2026-10-29.md` for the original audit.

---

## 1. One-paragraph summary

A single TanStack Start application (React 19) that server-renders public pages
and runs server functions and API routes. It talks to Supabase for
authentication, database (Postgres with row-level security) and file storage. An
AI assistant runs server-side, behind auth and budget checks, and answers from
published data plus a registry of skill playbooks. The build produces a
Cloudflare Worker plus static assets. Maps are keyless (Leaflet / OpenStreetMap).
No component of the running product depends on Lovable after Phase 2.

---

## 2. Components

| Layer | What it is | Key paths | Lovable coupling |
| --- | --- | --- | --- |
| App shell & routing | TanStack Start + React Router file routes | `src/routes/`, `src/router.tsx` | none (after Phase 1) |
| SSR entry | Error-wrapping server entry | `src/server.ts`, `src/start.ts` | none |
| Data access | Supabase client (browser, RLS) + admin client (server) | `src/integrations/supabase/` | none (after Phase 1) |
| Auth | Supabase auth; Google via Supabase OAuth | `src/routes/auth.tsx`, `src/lib/auth.ts` | **was** `cloud-auth-js` — removed |
| Domain logic | Pure, tested functions | `src/lib/*.ts` | none |
| AI assistant | Server route + skill registry + tools | `src/lib/assistant/`, `src/routes/api/assistant.ts` | **was** the Lovable AI gateway — now pluggable |
| Research engine | Scheduled feed ingestion | `src/lib/research/`, `src/routes/api/public/research/tick.ts` | none |
| MCP server | Optional tool surface | `src/lib/mcp/`, `src/routes/mcp.ts` | `mcp-js` plugin — Phase 2 |
| Build | Vite + Nitro → Cloudflare Worker | `vite.config.ts` | **was** `@lovable.dev/vite-tanstack-config` — Phase 2 |
| Hosting | Cloudflare Workers | `.output/server/wrangler.json` | was Lovable — Phase 2 |
| Database | Supabase Postgres + RLS | `drizzle/`, `src/lib/visibility.ts` | none |

---

## 3. Trust boundaries (these do not change)

These are the rules that keep the product safe. The migration must not weaken
any of them.

1. **Row-level security is the real access control.** The publishable key is
   public by design; RLS protects the rows. Never rely on UI filters.
2. **The service-role key never reaches the browser.** It is used only in
   `src/integrations/supabase/client.server.ts` and only from server code.
3. **Public visibility** is one rule — published + permitted + not demo —
   enforced in policies and re-applied in any server read that could bypass RLS
   (`src/lib/visibility.ts`, `src/lib/mcp/tools/*`).
4. **Property photos** live in a private bucket and are shown via short-lived
   signed links.
5. **Research agents** run only from the scheduler route or an admin-checked
   server function, never from the browser.
6. **The assistant** verifies the caller's token before spending money, and its
   tools act as the caller under RLS.

---

## 4. The AI assistant, after the provider change

```
browser ──POST /api/assistant──► chat.server.ts
                                   │ 1. verify token (Supabase)
                                   │ 2. per-user daily limit
                                   │ 3. save the user message
                                   │ 4. global budget reservation  ── fail closed
                                   │ 5. streamText against the provider
                                   │ 6. reconcile real usage vs reservation
                                   └─ provider = OpenAI-compatible
                                      (Lovable gateway | Gemini | Groq | OpenRouter | …)
```

The provider is chosen entirely by environment:

- `AI_BASE_URL` — the endpoint (default: the Lovable gateway, so nothing breaks
  until you change it).
- `AI_API_KEY` — the key; unset means the assistant is off.
- `AI_MODEL` — the model id.
- `AI_DAILY_BUDGET_INR` — the rupee cap; `0` stops all spend.

`src/lib/assistant/pricing.ts` is the only file that knows provider specifics.
`aiProviderHeaders()` returns the Lovable-only headers for the Lovable gateway
and nothing for everyone else, which is what lets one code path serve all
providers.

---

## 5. Build and deploy, after Phase 2

| Concern | Today (Lovable wrapper) | After |
| --- | --- | --- |
| Vite config | `@lovable.dev/vite-tanstack-config` | direct plugins (verified; see `docs/LOVABLE_EXIT.md` §3.1) |
| SSR server entry | `src/server.ts` via `tanstackStart.server.entry` | unchanged |
| Worker output | `cloudflare-module` preset | unchanged (pinned explicitly) |
| MCP routes | `@lovable.dev/mcp-js` plugin | removed or ported to the official SDK (D7) |
| Deploy | Lovable builds `main` | `wrangler deploy` from your CI |
| Env injection | Lovable's `VITE_*` injection | explicit `define` in `vite.config.ts` |
| Lockfile registry | Lovable's private npm cache (~120 packages) | `registry.npmjs.org` (`docs/LOVABLE_EXIT.md` §3.3) |

Versions in play (from `package.json`, verify in `node_modules` when editing):

- `@tanstack/react-start` `1.168.60`
- `@tanstack/react-router` `1.170.41`
- `nitro` `3.0.260603-beta` (pre-RC; its `vite` plugin signature may change)
- `vite` `8.1.5`, `@vitejs/plugin-react` `^5.2.0`, `@tailwindcss/vite` `^4.2.1`
- `vite-tsconfig-paths` `^6.0.2`

The Nitro version is a beta, which is the one genuinely fragile dependency in
the build swap. If the plugin API differs from the snippet, adjust the call
rather than the app. (The snippet in `docs/LOVABLE_EXIT.md` §3.1 was verified
against these exact versions and builds a working Worker.)

**Supply chain note.** `bun.lock` resolves most dependencies from Lovable's
private package cache rather than the public npm registry. The public registry
does serve the `@lovable.dev/*` packages, so this is a re-resolve, not a
rewrite — but it must be done before the Lovable subscription is cancelled, or a
fresh CI install may fail. Procedure in `docs/LOVABLE_EXIT.md` §3.3.

---

## 6. Data model note

`drizzle/schema.ts` is intentionally blank ("auto-generated and intentionally
left blank"). The authoritative schema is the SQL in `drizzle/migrations/`
(applied) and `drizzle/pending/` (not applied). The generated TypeScript types
live in `src/integrations/supabase/types.ts`. Four migrations are pending and
each gates a feature — see `docs/PLAN.md` D4.

---

## 7. What "no debug" means architecturally

There is no hidden state and no build-time magic once the Lovable wrapper is
gone. Every input to the running system is one of:

- an environment variable (documented in `docs/LOVABLE_EXIT.md` §4.2),
- a row in Supabase,
- a file in `public/` or `src/`.

That is the whole surface. If the live site misbehaves, one of those three is
wrong, and the smoke checklist in `docs/OPERATIONS.md` §4 finds which.
