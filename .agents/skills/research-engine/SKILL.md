---
name: research-engine
description: Use when changing the research engine, the scheduler tick, feed imports, research sources, research_ticks logging, or draft listing generation.
---

# Research engine and scheduler

## Structure

- `src/lib/research/core.ts` — pure rules, no I/O; tested in `core.test.ts`.
- `src/lib/research/engine.server.ts` — I/O: sources, fetching, writing drafts.
- `src/lib/research/fixture.ts` — deterministic fixtures for tests.
- `src/lib/research.functions.ts` — admin-checked server function entry.
- `src/routes/api/public/research/tick.ts` — the scheduler endpoint.

The admin client may run research **only** from the tick route or the
admin-checked server function. Never from the browser.

## Scheduler authentication

The tick authenticates with a token stored in the private schema and checked by a
service-role-only function. `src/integrations/supabase/cron-auth.ts` resolves the
secret: `CRON_SECRET` first, `LOVABLE_CRON_SECRET` kept as a legacy fallback. The
publishable key is public, so it cannot be the credential.

Every call is logged in `research_ticks`; automatic runs carry
`X-PropWise-Origin: pg_cron`, which distinguishes them from manual calls.

## Output rules

- Sources must be marked authorised and enabled; structured feeds only.
- Research never publishes. Output is a draft, unverified listing without listing
  permission; test fixtures are marked demo as well.
- Feed onboarding (CSV/JSON) requires identity, permission evidence and an ID field
  mapping; imports go through an admin-checked server function and stay private
  observations (`src/lib/listing-import.ts`).

## Known dependency

`engine.server.ts` currently reaches Google Places through Lovable's connector
gateway (`connector-gateway.lovable.dev`) using `LOVABLE_API_KEY` plus
`GOOGLE_MAPS_API_KEY`; it skips cleanly when the keys are absent. Replacing that
provider is a Tier 3, owner-approved change, not a refactor.

## Tests

This area uses vitest: `core.test.ts`, `research-health.test.ts`,
`research-network.test.ts`, and the tick test
`src/routes/api/public/research/tick.test.ts`.
