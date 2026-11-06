# PropWise AI — Master Plan (historical baseline)

> **Historical only (2026-11-06):** The owner confirms the exit from Lovable.dev and Lovable Cloud is already completed. Do not reopen that migration. The current architecture and execution order are in [INDEPENDENCE_PLAN.md](INDEPENDENCE_PLAN.md).

Owner-facing plan for (1) leaving Lovable, (2) running at zero cost, and (3)
making the app fully functional with no debug work left over.

Status date: 2026-11-06. Baseline audited: `main` @ `c543147`.

This is the plan you refer back to. It is written to be read by a person, in
order, once. The other documents it points at hold the detail:

| Document | What it is for |
| --- | --- |
| `docs/PLAN.md` | This file. Phases, milestones, decisions, risks. |
| `docs/LOVABLE_EXIT.md` | The exact, step-by-step exit runbook. |
| `docs/COST_MODEL.md` | What is free, what costs money, and the switches. |
| `docs/ARCHITECTURE.md` | The target system, component by component. |
| `docs/OPERATIONS.md` | Day-to-day running: deploy, env, rollback, scheduler. |
| `docs/TESTING.md` | How to prove a change works before it ships. |
| `docs/IMPLEMENTATION_TRACKER.md` | The older, feature-level delivery ledger. Still valid. |
| `AGENTS.md` | The rules an AI agent must follow on this repository. |

---

## 1. Where the project stands today (verified)

These numbers were produced on this machine, on `main` @ `c543147`, not quoted
from another document:

- `bun run test` — **584 tests pass**, 64 files.
- `bun run build` — **passes**, ~2.9s. Output is a Cloudflare Worker
  (`cloudflare-module` preset) plus static assets.
- `bun run type-check` — passes.
- `bun run lint` — reports pre-existing formatting debt only; not blocking.

The application itself is in good shape: it is a real TanStack Start app with
Supabase (auth + database + storage), a property listing product, a locality
intelligence product, and an AI assistant. The problem is not the code. The
problem is that it is **wired to Lovable** at several levels, and Lovable is a
paid platform with a per-project subscription and an AI credit model.

### 1.1 The things that tie this project to Lovable

1. **Build configuration** — `@lovable.dev/vite-tanstack-config` is the Vite
   wrapper. It is the only reason `vite.config.ts` looks unusual.
2. **AI provider** — the assistant calls `ai.gateway.lovable.dev` with a
   `LOVABLE_API_KEY`. This is the one part that spends money per message.
3. **Auth** — Google sign-in went through `@lovable.dev/cloud-auth-js`.
4. **Hosting/URLs** — 20 route files hardcoded `emerald-property-hub.lovable.app`.
5. **Packages** — `bun.lock` resolves ~120 packages from Lovable's **private**
   npm cache (`europe-west4-npm.pkg.dev/lovable-core-prod/...`). This is the
   most easily overlooked coupling: it is invisible in `package.json` and would
   break a fresh `bun install` after the subscription is cancelled. See
   `docs/LOVABLE_EXIT.md` §3.3.
6. **Governance** — `AGENTS.md` described a Lovable-specific release process
   ("Lovable deploys", history-rewrite warnings).

### 1.2 What is already done (this session)

Phase 1 of the plan below is **implemented on a branch, tests and build green**:

- A single `src/lib/site.ts` now owns the public origin. All 20 hardcoded URLs
  are gone; the domain is one variable (`VITE_SITE_URL`).
- Google sign-in uses Supabase's own OAuth. `@lovable.dev/cloud-auth-js` and
  `src/integrations/lovable/` are deleted.
- The Lovable preview auth broker (`previewAuthStorage.ts`) is deleted; the
  client uses plain browser storage.
- Error reporting is vendor-neutral (`src/lib/error-reporting.ts`).
- The AI provider is pluggable (`src/lib/assistant/pricing.ts`): any
  OpenAI-compatible endpoint, chosen by `AI_BASE_URL` / `AI_API_KEY` /
  `AI_MODEL`, with the Lovable gateway as the default so nothing breaks yet.
- Secret names are neutral-first: `CRON_SECRET`, `DATABASE_MIGRATION_URL`, with
  the `LOVABLE_*` names kept as fallbacks.

What is **not** done yet: the build-config swap, the lockfile re-resolve, and the
package removals (items 1, 5, and the registry). The replacement build config is
**verified working** (it was built and tested on this machine — see
`docs/LOVABLE_EXIT.md` §3.1), but it is left out of Phase 1 on purpose: changing
how the app builds while Lovable still deploys it risks a build Lovable cannot
ship. It belongs in Phase 2, where you control the deploy target. That is the
single highest-risk change in the migration, so it is isolated.

---

## 2. The three goals, and what "done" means for each

### Goal A — Stop using Lovable
Done when: no `@lovable.dev/*` package is in `package.json`; no source file
imports one; the app builds and deploys without any Lovable service; and the
Lovable project can be cancelled without the live site changing.

### Goal B — Zero cost, for now
Done when: the running site costs ₹0/month. That means a free hosting tier
(Cloudflare Workers free), a free database tier (Supabase free), and the AI
assistant either off or pointed at a free model tier, with a hard daily budget
of ₹0 as the backstop so a mistake cannot create a bill.

Important honesty: **zero cost has a ceiling.** Free tiers have limits. The
plan keeps the app inside them and tells you which limit you will hit first.
See `docs/COST_MODEL.md`.

### Goal C — Fully functional, no debug left
Done when: every feature the app claims either works end to end or is clearly
marked "not open yet"; the test suite covers the logic; and the owner can run a
short checklist to confirm the live site is healthy. See Phase 3.

---

## 3. Principles this plan follows

1. **The site must never break for a visitor because of this migration.** Every
   step is reversible, and the live site stays up throughout.
2. **No secrets in git, ever.** Names are documented; values live only in the
   host's environment settings.
3. **One change per pull request.** A migration that rewrites everything at once
   cannot be reviewed or rolled back.
4. **Honest labels.** If something is not verified, it says so. This applies to
   the docs as much as the product.
5. **Fail closed on money.** If the budget check cannot run, the AI call is
   refused, not allowed. A broken deploy must not become an unbounded bill.

---

## 4. Phase map

| Phase | Name | Outcome | Owner action needed |
| --- | --- | --- | --- |
| 0 | Stabilise & de-risk | Green baseline, migration risk understood | Review only |
| 1 | De-Lovable the app code | No Lovable imports in app code | Merge PR |
| 2 | Swap the build config & host | Deploy to Cloudflare Workers yourself | Create accounts, set env |
| 3 | Make it fully functional | Every feature works or is labelled | Test checklist |
| 4 | Growth (later) | Payments, memberships, riders | Decisions + money |

Phases 1 and 2 are the migration. Phase 3 is the "no debug" goal. Phase 4 is
deliberately last: it is the only phase that adds cost, and it should not start
until the free product is solid.

---

## 5. Phase 0 — Stabilise & de-risk

**Outcome:** the project is on solid footing and the migration is scoped.

| Milestone | Status | Evidence / note |
| --- | --- | --- |
| 0.1 Green baseline recorded | done | 584 tests, build passes (this session) |
| 0.2 Lovable coupling enumerated | done | §1.1 above |
| 0.3 Migration plan written | done | this document |
| 0.4 Owner decisions collected | open | §9 below — decisions only you can make |
| 0.5 Repo hygiene: old branches reviewed | open | ~40 remote branches; most merged |

**Acceptance:** you have read §9 and answered the decisions.

---

## 6. Phase 1 — De-Lovable the application code

**Outcome:** the application no longer imports anything from Lovable. It still
*defaults* to Lovable services where a value was previously hardcoded, so the
live site is unaffected, but every one of those defaults is now an environment
variable you can point elsewhere.

**Status:** implemented on branch `chore/delovable-phase1` (this session), tests
and build green. Not yet merged.

| Milestone | Status | What changed |
| --- | --- | --- |
| 1.1 One place for the public URL | done | `src/lib/site.ts`; 20 route files de-hardcoded |
| 1.2 Supabase-native auth | done | `src/routes/auth.tsx`; `src/integrations/lovable/` deleted |
| 1.3 Remove preview auth broker | done | `previewAuthStorage.ts` deleted |
| 1.4 Vendor-neutral error reporting | done | `src/lib/error-reporting.ts` |
| 1.5 Pluggable AI provider | done | `src/lib/assistant/pricing.ts` |
| 1.6 Neutral secret names | done | `CRON_SECRET`, `DATABASE_MIGRATION_URL` |
| 1.7 Tests for the new seams | done | `site.test.ts`, `pricing.test.ts` |

**Acceptance criteria (met):**
- `bun run test` passes (584).
- `bun run build` passes.
- `grep -r "@lovable.dev" src/` returns only plugin-generated files (`mcp.ts`,
  `.well-known`), which Phase 2 removes.

**Owner action:** merge the Phase 1 pull request. Nothing else. The live site is
unchanged because every default still points at the current services.

**Why the build config is not in this phase:** swapping
`@lovable.dev/vite-tanstack-config` changes how the app builds and how it is
deployed at the same time. Doing it while Lovable still deploys the site risks
producing a build Lovable cannot ship. It belongs in Phase 2, where you control
the deploy target. This is the single highest-risk change in the migration and
is treated as such.

---

## 7. Phase 2 — Swap the build config and host it yourself

**Outcome:** the site is built and deployed by you, on Cloudflare's free tier,
with no Lovable package anywhere.

| Milestone | Status | Detail |
| --- | --- | --- |
| 2.1 Replace the Vite wrapper | **config verified** | Direct plugin config; builds a working Cloudflare Worker (see `docs/LOVABLE_EXIT.md` §3.1) |
| 2.2 Decide the MCP server | open | D7: drop `src/lib/mcp/`, or port to the official SDK |
| 2.3 Re-resolve the lockfile | todo | `bun.lock` pulls ~120 packages from Lovable's private registry — see `docs/LOVABLE_EXIT.md` §3.3 |
| 2.4 Remove the `@lovable.dev/*` packages | todo | After 2.1–2.3 |
| 2.5 Cloudflare Workers deploy | todo | Build already emits a Worker; wire `wrangler` deploy + env |
| 2.6 Set environment variables in Cloudflare | todo | Supabase URL/key, cron secret, AI config, `VITE_SITE_URL` |
| 2.7 Custom domain | todo | Point DNS at Cloudflare; set `VITE_SITE_URL` |
| 2.8 CI: replace "Lovable deploys" with a real deploy job | todo | Keep `Verify`; add a gated deploy workflow |
| 2.9 Cancel Lovable | todo | Only after 2.1–2.8 are verified on the live domain |

**Acceptance criteria:**
- A clean clone builds with no Lovable package installed.
- `grep -c "pkg.dev" bun.lock` returns `0` (no private-registry URLs).
- `wrangler deploy` ships the site to your Cloudflare account.
- The live site answers on your domain with the assistant and listings working.
- The `Verify` workflow is green and the deploy is gated on it.

**Owner actions:** create the Cloudflare account; add the Supabase project's
environment variables in the Cloudflare dashboard; move DNS; cancel Lovable
last. Full steps in `docs/LOVABLE_EXIT.md`.

---

## 8. Phase 3 — Make it fully functional, no debug

**Outcome:** what the app shows is what the app does. This is the "no debug"
goal, and it is a checklist you can actually run.

| Milestone | What "done" looks like |
| --- | --- |
| 3.1 Live smoke checklist | Every public route loads; no console errors; a short script in `docs/OPERATIONS.md` §4 |
| 3.2 Auth end to end | Email sign-up/sign-in, Google sign-in, session persists, sign-out works |
| 3.3 Data paths verified | Listings, localities, area intelligence, maps render from real rows |
| 3.4 Assistant behaviour | With a key set: answers, cites evidence, refuses unknown facts. With no key: a clean "unavailable" message, never a crash |
| 3.5 Feature flags honest | Community / owner submissions / interest requests either work (migration applied) or show "not open yet" |
| 3.6 Pending migrations decided | Apply or archive `drizzle/pending/*`; each gates a feature |
| 3.7 Photo access finding closed | The one security finding in `roadmap.md` — owner-owned, needs a decision |
| 3.8 Error monitoring | Optional; the hook exists in `error-reporting.ts` |
| 3.9 Accessibility & responsive | The Playwright suite in `e2e/` passes |

**Acceptance criteria:** the smoke checklist passes on the live domain, and every
feature is either working or visibly labelled as not open. No dead buttons, no
silent failures.

**Blocked items (need you, not code):** applying migrations, the photo-access
fix, and supplying real listing data. These are marked `blocked` in
`roadmap.md` and `docs/IMPLEMENTATION_TRACKER.md`; they stay blocked until you
act, and the plan does not pretend otherwise.

---

## 9. Owner decision log

These are the decisions only you can make. The plan pauses on each.

| # | Decision | Why it matters | Default if you do nothing |
| --- | --- | --- | --- |
| D1 | Host on Cloudflare Workers (recommended, already the build target) or another free host? | Determines Phase 2 steps | Stays on Lovable, keeps paying |
| D2 | Custom domain now, or use the free `*.workers.dev` address first? | A domain costs ~₹800/yr; the subdomain is free | Free subdomain |
| D3 | AI assistant: on with a free model tier, or off until you fund it? | This is the only per-message cost | **Off** (₹0 budget) until you set a key |
| D4 | Apply the four pending migrations, or archive them? | Gates community, submissions, interest requests, buy/rent/lease storage | Stay unapplied; features stay "not open" |
| D5 | Rotate the leaked Google Maps key? | It is a real credential in git history | Stays exposed |
| D6 | Keep the Google Maps connector, or drop it (the app now uses keyless Leaflet)? | Removing it drops a dependency and a secret | Kept, unused |
| D7 | Keep the MCP server, or drop it? | Keeping it means porting ~300 lines to the official SDK; dropping it is simpler | Kept, still on `@lovable.dev/mcp-js` |
| D8 | Migrate existing data from `dashpanandamjickoytj`, or start the new project empty? | An empty start is simpler; the live site keeps its data until cutover either way | Owner's call — see `docs/LOVABLE_EXIT.md` §3.1.2 step 4 |

Recommended answers: D1 Cloudflare; D2 free subdomain first; D3 off until the
free product is solid, then a free Gemini/Groq tier; D4 apply only what you
intend to launch; D5 rotate now; D6 drop it; D7 drop it unless you are actively
using MCP clients; D8 start empty unless there is real listing data you need.

---

## 10. Risk register

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Build-config swap breaks the build | Low | High | **Verified working** (`docs/LOVABLE_EXIT.md` §3.1); still isolated in its own PR, old config kept until green |
| Lockfile pins ~120 packages to Lovable's private registry | Medium | High | Re-resolve `bun.lock` against npmjs.org (§3.3); CI's `--frozen-lockfile` could otherwise fail after cancelling |
| A build silently uses the Lovable Supabase project | **Fixed** | High | Fallback removed from `vite.config.ts`; `supabase/config.toml` repointed; guarded by `src/test/build-config.test.ts` |
| Data not migrated before cutover, giving an empty live site | Medium | High | Ordered cutover in `docs/LOVABLE_EXIT.md` §3.1.2; verify row counts, not just that the export ran |
| Free tier limit hit (Worker requests, Supabase bandwidth) | Low now | Medium | `docs/COST_MODEL.md` lists the limits and the first one you will hit |
| AI spend runs away | Low | High | Per-user cap + global daily budget + fail-closed; default ₹0 |
| Data loss during migration | Low | High | Migration touches no data; Supabase backups unchanged; `docs/OPERATIONS.md` §5 |
| Leaked Maps key abused | Medium | Medium | Rotate it (D5) |
| Lost Lovable project history | Low | Medium | Do not rewrite git history; export anything you need from Lovable before cancelling |
| A feature is announced but its migration is unapplied | High | Medium | Phase 3.6; features stay flagged off |

---

## 11. Definition of done (project level)

The migration is complete when all of these are true:

1. `grep -r "@lovable.dev" package.json src/` returns nothing.
2. `bun run test` and `bun run build` pass on a clean clone.
3. The live site runs on your Cloudflare account on your domain.
4. The assistant is either off (₹0) or on a free tier with a hard cap.
5. The Phase 3 smoke checklist passes.
6. Lovable is cancelled and nothing changed for visitors.

---

## 12. How to track progress

- Update the **Status** columns in §5–§8 as milestones land. This file is the
  plan; keep it truthful rather than optimistic.
- Feature-level detail continues in `docs/IMPLEMENTATION_TRACKER.md`.
- Every change still goes through a pull request and the `Verify` workflow.
  After Phase 2, the human key is your own review; the machine key is unchanged.
