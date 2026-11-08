---
name: verification
description: Use before opening a pull request, when deciding what evidence a change needs, or when running the test and build gates.
---

# Verification and pull-request evidence

## Commands

```sh
bun run test          # vitest, blocking
bun run build         # production build, blocking
bun run type-check    # reported, not blocking
bun run lint          # reported, not blocking
bun run test:e2e      # Playwright, optional locally
node --test scripts/cto/*.test.mjs   # agent-harness policy tests
node scripts/verify-journeys.mjs     # regenerates test-evidence/ (needs dev server)
```

`Verify` (`.github/workflows/verify.yml`) runs `bun install --frozen-lockfile`,
tests and build on every pull request. A green `Verify` plus owner approval is the
two-key rule; neither key is optional.

## Test locations

1. Colocated `src/**/*.test.ts(x)` — most unit and component tests (vitest).
2. `src/test/` — setup file plus cross-cutting tests (routing, build config,
   navigation, public copy).
3. `scripts/cto/*.test.mjs` — `node:test` policy suites.
4. `e2e/` — Playwright smoke, accessibility and responsive specs.
5. `scripts/verify-journeys.mjs` — evidence generator, not a gate.

## Evidence on the pull request

Use `.github/PULL_REQUEST_TEMPLATE.md`. State the five points: problem, change, how
tested, **what was not tested and remains uncertain**, and whether the change can
affect security, data or the public site. The fourth point is the most valuable.

Screenshots go in `test-evidence/` (the archived `docs/archive/PULL_REQUEST.md`
shows the original pattern). Do not claim a test passed unless you ran it.

## Never run

- `drizzle-kit generate` or `drizzle-kit push`. `drizzle/schema.ts` is an
  intentional blank stub, so a diff against it can produce a destructive
  migration. The schema is the hand-written SQL in `drizzle/migrations/` plus
  `drizzle/pending/`.
- `supabase start`. `supabase/config.toml` is a single `project_id`; the Supabase
  CLI is not the schema source.
- Migrations, deploys, production data access, or any command using a secret from
  the Secrets list in `AGENTS.md`.

## Tiers

Tier 0 read-only; Tier 1 tests, docs and pure logic; Tier 2 pages, components and
public content with the five evidence points; Tier 3 auth, payments, scheduler,
service-role code, `.github/` and `drizzle/`, which the owner does. Exact paths are
in `.github/CODEOWNERS`.
