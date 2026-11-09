# PropWise AI — Current State and Implementation Backlog

**Type:** read-only inventory and prioritised backlog. No code was changed to
produce this document; no migration was applied, nothing was deployed and no
production data was touched.
**Audited by:** AI agent (OpenHands).
**Date:** 2026-11-06.
**Baseline:** `main` @ `776c4d4` (PR #46 merge, `docs/lovable-cloud-independence-20261106`).
**Companion documents:** [`INDEPENDENCE_PLAN.md`](INDEPENDENCE_PLAN.md) is the
canonical plan. [`archive/PLAN.md`](archive/PLAN.md) and
[`archive/LOVABLE_EXIT.md`](archive/LOVABLE_EXIT.md) are historical and marked as
such in their own headers.

This document answers one question: **what actually works today, and what is
left to do?** Every claim cites a file or a command output. Where something could
not be verified without a live backend, it says so rather than guessing.

---

## 1. Verification evidence (run on this machine, 2026-11-06)

| Check | Command | Result | Blocking? |
| --- | --- | --- | --- |
| Unit / component tests | `bun run test` | **590 passed, 65 files, 0 failed** (17.0s) | yes |
| Type-check | `bun run type-check` | **exit 0**, no errors | reported |
| Production build | `bun run build` | **exit 0** (Nitro → Cloudflare Worker) | yes |
| Lint | `bun run lint` | **3832 problems** (3811 errors, 21 warnings) | reported |
| Browser (Playwright) | `bun run test:e2e` | **80 passed** (smoke + responsive, 3 viewports) | optional |

Environment: Debian 13, Node v24.21.0, Bun 1.4.3 (matches `verify.yml`). The e2e
run used placeholder public Supabase values and no backend, which is what the
suite is designed for (`playwright.config.ts` header comment).

Lint breakdown — the failure is almost entirely formatting, not correctness:

- **3802 of 3832** problems are `prettier/prettier`; all are auto-fixable
  (`bun run lint --fix`).
- **30** problems are real, and 25 of those are warnings:
  - `react-refresh/only-export-components` × 17 (warnings)
  - `@typescript-eslint/no-explicit-any` × 6 — `src/components/LocalityMap.tsx:23`,
    `src/lib/maplibre.ts:7,11,14`, `src/routes/explore.tsx:58,176`
  - `react-hooks/exhaustive-deps` × 4 (warnings)
  - `no-irregular-whitespace` × 2 — `src/lib/assistant/skills.ts:49`,
    `src/lib/listing-import.ts:51`
  - `no-control-regex` × 1 — `src/lib/oauth-return-path.ts:2`

This matches the debt recorded in `AGENTS.md` and `docs/TESTING.md`. **Do not fix
it inside an unrelated PR** (see `AGENTS.md`, "Keep pull requests small").

---

## 2. Inventory

### 2.1 Size

| Area | Count | Location |
| --- | --- | --- |
| Routes (non-test) | 34 | `src/routes/` |
| Route-level tests | 3 | `src/routes/*.test.ts` |
| Components | 101 | `src/components/` |
| — of which shadcn UI primitives | 49 | `src/components/ui/` |
| — admin panels | 23 | `src/components/admin/` |
| Library modules | 93 non-test (+ 56 tests) | `src/lib/` |
| Tests | 65 files / 590 cases | `src/**` |
| Assistant skills | 17 + `README.md` | `src/lib/assistant/skills/*/SKILL.md` |
| Applied migrations | 19 | `drizzle/migrations/0000–0018` |
| Pending migrations | 5 | `drizzle/pending/0017–0021` |
| Docs | 19 | `docs/` |

### 2.2 Routes

Public: `/`, `/properties`, `/properties/$id`, `/explore`, `/map`, `/compare`,
`/location-intelligence` (+ `/$area`, `/compare`), `/infrastructure`,
`/research-services`, `/community`, `/community/$threadId`, `/owners`,
`/consult`, `/contact`, `/contribute`, `/privacy`, `/terms`, `/disclaimer`,
`/auth`, `/advisor` (redirect → `/properties`, `src/routes/advisor.tsx`).

Authenticated: `/_authenticated/assistant`, `/_authenticated/my`,
`/_authenticated/admin` (gated by `src/routes/_authenticated/route.tsx` +
`useIsAdmin` in `src/lib/auth.ts`).

Server endpoints: `/api/assistant` (`src/routes/api/assistant.ts`),
`/api/public/research/tick` (`src/routes/api/public/research/tick.ts`),
`/mcp` + `/.well-known/oauth-protected-resource` (Lovable MCP plugin),
`/sitemap.xml`, `/robots.txt`.

### 2.3 Dependencies

70 runtime, 26 dev. Notable: React 19.2.8, TanStack Start/Router, Vite, Vitest
4.1.11, Tailwind 4.3.3, Zod 4.6.6, `@ai-sdk/openai` + `@ai-sdk/react`,
`@supabase/supabase-js`, Leaflet 1.9.4, Recharts, Streamdown.

Three Lovable packages remain (see §6.2): `@lovable.dev/vite-tanstack-config`
(dev), `@lovable.dev/mcp-js` (runtime), `@lovable.dev/cloud-auth-js` (runtime,
**no importers**).

---

## 3. Working

Verified by tests or by a green build plus a reading of the code path.

### 3.1 Buy / rent / lease core model

- One `properties` table; `transaction_type` distinguishes the three deals.
  Pure rules in `src/lib/transaction.ts` (`priceFields`, `priceUnit`,
  `REQUIRED_TERMS`, `missingTerms`, `hasComparablePrice`, `transactionTypeOf`).
  Covered by `src/lib/transaction.test.ts`.
- Buy and rent maths: `src/lib/buyer.ts` (`emi`, `buyAnalysis`, `rentAnalysis`,
  `rentVsBuy`), tested in `src/lib/buyer.test.ts`. Rental rules in
  `src/lib/rental.ts`, lease rules in `src/lib/lease.ts` (both tested).
- Discovery honours the transaction type: `src/routes/properties.index.tsx:91–95`
  filters `transactionTypeOf(p) !== type`, and the shared
  `TransactionSelector` (`src/components/TransactionSelector.tsx`) switches the
  whole page.
- Property detail page renders type-aware labels and terms
  (`src/routes/properties.$id.tsx` — `priceLabel(type)`, `monthly`, and
  `<TransactionTerms>` at line 164).
- "My property research" (`src/routes/_authenticated/my.tsx`) has working
  Preferences, Buy, Rent, Rent-vs-buy, Matches and Reports tabs, with save /
  download / delete.

### 3.2 Public visibility and privacy

- One rule, enforced in RLS and mirrored in app code:
  `published AND listing_permission AND NOT is_demo`
  (`src/lib/visibility.ts`, `publicPropertiesQuery` in `src/lib/data.ts:89–99`).
  Tested in `src/lib/visibility.test.ts`.
- Photos stay private and are shown through short-lived signed links; the
  browser will not request a link for a non-public row except for an admin
  preview (`src/lib/photo-access.ts`, `usePropertyPhotoUrls` in
  `src/lib/data.ts:139–145`; tested in `src/lib/photo-access.test.ts`).
- Assistant and MCP listing tools re-apply the public filter explicitly, so an
  admin caller never sees drafts (`src/lib/assistant/tools.ts:99–101`,
  `src/lib/mcp/tools/search-listings.ts:52–54`).

### 3.3 AI assistant

- End-to-end wiring is present: homepage entry (`planAssistantEntry` in
  `src/lib/assistant/entry.ts`, used by `src/routes/index.tsx:67–89`) → sign-in
  hand-off → `/assistant` chat UI (`src/routes/_authenticated/assistant.tsx`,
  streaming via `DefaultChatTransport` to `/api/assistant`) →
  `handleAssistantChat` (`src/lib/assistant/chat.server.ts`).
- Token-verified, RLS-scoped DB client; per-user 15-message daily allowance;
  message save; skill loading; tool calls; usage reconciliation
  (`chat.server.ts:48–168`).
- 17 skills load and validate (`src/lib/assistant/skill-files.ts`; tested in
  `skills.test.ts`, `skill-content.test.ts`).
- Budget enforcement **fails closed**: any error, missing function or unpriced
  model refuses the call (`src/lib/assistant/budget.server.ts:69–91`; tested in
  `budget.server.test.ts`).

### 3.4 Locality / area intelligence and admin

- Locality pages and comparison
  (`src/routes/location-intelligence.{index,$area,compare}.tsx`), area rules in
  `src/lib/area-intel.ts` and `src/lib/locality-compare.ts` (tested).
- Flood context (`src/components/FloodPanel.tsx`, `src/lib/flood.ts`) is used by
  the area page and tested (`FloodPanel.test.tsx`, `flood-official.test.tsx`).
- 23 admin panels wired in `src/routes/_authenticated/admin.tsx` (Overview,
  Listings, Enquiries, Buyers, Visits, Commissions, ResearchAgents, AreaIntel,
  Localities, Submissions, CommunityQueue, AiCosts, IntelligenceGaps, …).

### 3.5 SEO / sitemap / accessibility

- Route-level sitemap decisions drive a session-free sitemap
  (`src/lib/sitemap.ts`, `src/routes/sitemap[.]xml.ts`); tested in
  `src/test/app-routing.test.tsx` and `src/lib/sitemap-properties.test.ts`.
- Browser guards for layout overflow and accessible names pass at 375 / 768 /
  1440 px (`e2e/responsive.spec.ts`, `e2e/accessibility.spec.ts` via `e2e/helpers.ts`).

---

## 4. Incomplete

### 4.1 AI assistant depends on a pending migration to answer at all — **highest priority**

`reserveBudget` calls the `reserve_ai_budget` RPC
(`src/lib/assistant/budget.server.ts:69–91`). That function is defined **only**
in the unapplied `drizzle/pending/0021_ai_cost_control.sql`
(`reserve_ai_budget` at line 85, `reconcile_ai_budget` further down).

Consequence: on a backend where `0021` is not applied, every assistant call
returns **503 "enforcement unavailable"** by design — the code refuses rather
than spend unboundedly. The admin panel states this plainly
(`enforcementAvailable: false` — `src/lib/ai-costs.functions.ts:41–54`,
`src/components/admin/AiCosts.tsx:36`). The assistant therefore *works* only when
the migration is applied and an `AI_API_KEY` is configured.

**Not tested here:** whether `0021` is applied on the owner's current backend. I
cannot read production state. This must be confirmed before any "fix" — do not
assume the RPC is missing and do not apply SQL (`AGENTS.md`: agents never apply
migrations).

### 4.2 AI gateway still points at Lovable by default

`src/lib/assistant/pricing.ts:30`:

```
export const AI_GATEWAY_URL = env("AI_BASE_URL") || "https://ai.gateway.lovable.dev/v1";
```

The neutral `AI_BASE_URL` / `AI_API_KEY` names take precedence, so a configured
deployment is not pinned to Lovable, but the **default remains the Lovable
gateway** and Lovable-only headers are still sent to it
(`pricing.ts:48`, `chat.server.ts:11–15` `run-id.ts` helpers). `pricing.test.ts`
pins this behaviour rather than removing it. This is residual code, not proof of
active Lovable Cloud use (per `INDEPENDENCE_PLAN.md` §3).

### 4.3 Rent / lease journeys need `0019` to function on a live backend

`properties.transaction_type` and the rent/lease term columns are added by
`drizzle/pending/0019_buy_rent_lease.sql`. The app already reads them through a
narrow shape precisely because the generated types and the live schema may not
have them yet (`TransactionFields` in `src/lib/transaction.ts:130–160`). With
`0019` unapplied, `transactionTypeOf` falls back to `buy` for every row, so rent
and lease filtering returns nothing. The assistant/MCP search tools have the
same dependency (`src/lib/assistant/tools.ts:104`).

### 4.4 Lease is thinner than buy/rent in the seeker UI

`buyer_profiles` gains a `lease` intent and `lease_months` / `permitted_use`
columns in `0019`, and `matchProperty` handles lease
(`src/lib/buyer.ts:88–89`), but the "My property research" intent selector only
offers **Buy** and **Rent** (`src/routes/_authenticated/my.tsx:148`). Lease
seekers have no profile path. This is a genuine gap, not a bug.

### 4.5 Video feature is built but not surfaced

`drizzle/migrations/0016_property_videos.sql` adds `video_urls`, and
`src/lib/video.ts` implements parsing/embed/thumbnail with a test
(`src/lib/video.test.ts`), but **no route or component imports it** and the
property detail page never renders a video. Either wire it up or record it as
deferred.

### 4.6 Feature flags are off by default

`feature_community`, `feature_owner_submissions`, `feature_interest_requests`
are seeded as `'off'` (`drizzle/migrations/0013_phase1_flags.sql`). The gated
pages therefore show the "Not open yet" state
(`src/components/NotOpenYet.tsx`; `src/routes/community.tsx:28`,
`src/routes/owners.tsx:33`). This is intentional, not broken — but it means
Community, owner submissions and interest requests are **not live**.

---

## 5. Duplicated / obsolete

Nothing here should be deleted without a dedicated, reviewed PR
(`INDEPENDENCE_PLAN.md` §5). This section only classifies candidates.

### 5.1 Obsolete — safe removal candidates (verified zero importers)

Each was checked with a repo-wide import scan; the only references are the file
itself and its own test.

| File | Evidence |
| --- | --- |
| `src/lib/maplibre.ts` | No importer anywhere; maps moved to Leaflet. Also carries 3 `no-explicit-any` lint errors. |
| `src/lib/maps.functions.ts` | No importer; superseded by keyless `src/lib/open-location-search.ts`. Tier 3 (owner-only, listed in `CODEOWNERS`). |
| `src/lib/geography.ts` | Only referenced by `src/lib/geography.test.ts`; superseded by `src/lib/localities.ts`. |
| `src/lib/video.ts` | Only referenced by `src/lib/video.test.ts`; see §4.5. |
| `src/lib/research-health.ts` | Only referenced by `src/lib/research-health.test.ts`; admin reads `research_ticks` directly (`src/components/admin/ResearchAgents.tsx:39`). |
| `src/lib/research-network.ts` | Only referenced by `src/lib/research-network.test.ts`; `0020_local_research_network.sql` is unapplied. |
| `src/routes/[.]lovable.oauth.consent.tsx` | Lovable consent screen; part of the MCP plugin surface. |
| `.lovable/` (`project.json`, `mcp/manifest.json`, `north-star/north-star.md`) | Lovable project metadata; `manifest.json` still names the legacy project ref `dashpanandamjickoytj`. |
| `@lovable.dev/cloud-auth-js` (`package.json`) | Zero importers in `src/`. |

> `docs/archive/roadmap.md` already flags the `maps.functions.ts` / `places.functions.ts` /
> `research/engine.server.ts` Google-connector removal as blocked (owner-only).
> Removal of the first two is a Tier 3 change.

### 5.2 Dead but load-bearing — keep

- `src/integrations/supabase/cron-auth.ts` — **no importers** in `src/`, but it
  is generated and may be wired by the scheduler binding; do not delete
  casually. Flagged, not condemned.
- `src/lib/error-capture.ts`, `src/lib/error-page.ts` — reachable from
  `src/server.ts` / `src/start.ts` (not via `@/lib` imports, which is why a naive
  scan misses them). Working.

### 5.3 Unused UI primitives

26 shadcn primitives in `src/components/ui/` have no importer: `accordion`,
`alert-dialog`, `alert`, `aspect-ratio`, `avatar`, `breadcrumb`, `calendar`,
`card`, `carousel`, `chart`, `context-menu`, `drawer`, `form`, `input-otp`,
`menubar`, `navigation-menu`, `pagination`, `popover`, `progress`, `radio-group`,
`resizable`, `scroll-area`, `sidebar`, `slider`, `table`, `toggle-group`. These
are vendor scaffolding; removal is cosmetic and low value. Recommend leaving
them until a dedicated cleanup PR.

### 5.4 Documentation overlap

`PLAN.md` and `LOVABLE_EXIT.md` are already marked "Historical only" in their
headers and `README.md` points at `INDEPENDENCE_PLAN.md` as current. `PLAN.md`,
`LOVABLE_EXIT.md`, `runbook.md`, `audit-2026-10-29.md` and
`IMPLEMENTATION_TRACKER.md` still name the legacy project ref
`dashpanandamjickoytj` — acceptable in an archival record, but it means a naive
grep for the old ref is noisy. `docs/TESTING.md:20` states a stale baseline
("584 tests, `main` @ `c543147`"); the real baseline is now 590 @ `776c4d4`.

### 5.5 Stale doc numbers

`docs/APPLY_RUNBOOK.md:16` says migrations are applied "at `0018_owner_submissions`"
and lists five pending files — still accurate. But it also documents the
`0017`/`0018` numbering collision between `drizzle/migrations/` and
`drizzle/pending/`; that collision is real and worth a rename in a future PR.

---

## 6. Blocked / external

### 6.1 Blocked on the owner or on external inputs

| Item | Blocked on | Evidence |
| --- | --- | --- |
| Real Chennai listings | Authorised listing details + permission evidence not supplied | `docs/archive/roadmap.md` |
| Publish site | Photo-access finding to be fixed first (owner-only signing change) | `docs/archive/roadmap.md`, `src/lib/photo-access.ts` header |
| Remaining area data | Free Overpass providers time out intermittently | `docs/archive/roadmap.md` |
| Google API removal | `maps.functions.ts`, `places.functions.ts`, `engine.server.ts` are Tier 3 | `CODEOWNERS`, `docs/archive/roadmap.md` |
| Payments / subscriptions / riders | Product decisions + legal review | `docs/archive/roadmap.md`, `INDEPENDENCE_PLAN.md` §1 |

### 6.2 Residual Lovable code (cleanup, not migration)

- `@lovable.dev/vite-tanstack-config` — `vite.config.ts:7` (Tier 3, `CODEOWNERS`).
- `@lovable.dev/mcp-js` — `src/lib/mcp/*`, `src/routes/mcp.ts`,
  `src/routes/[.well-known]/oauth-protected-resource.ts`.
- `bunfig.toml:7` exempts four `@lovable.dev/*` packages from the 24h
  supply-chain guard.
- `supabase/config.toml` names an independent project (`lgetjiksdzoqfryelvmv`),
  and `src/test/build-config.test.ts` **guards** against reintroducing the legacy
  ref — that guard passes today.

---

## 7. Prioritised implementation backlog

Each item is one small PR, in dependency order. Nothing here restarts the
Lovable exit.

### P0 — Decide, do not guess

1. **Confirm the live backend schema.** Read-only: check whether
   `reserve_ai_budget` and `properties.transaction_type` exist on the owner's
   current project. This unblocks items 2 and 3. *No SQL is applied by an agent.*
   — *Owner action.*

### P1 — Critical user journeys

2. **Assistant availability.** Once item 1 is known: either apply `0021` (owner)
   or add a clearly-labelled degraded mode so the assistant says "temporarily
   unavailable" instead of a generic 503. Files: `src/lib/assistant/budget.server.ts`,
   `src/lib/assistant/chat.server.ts`, `src/components/admin/AiCosts.tsx`.
3. **Rent / lease journeys.** Once `0019` is known: confirm the rent/lease filter
   returns rows; add a deterministic test for the fallback-to-buy path. Files:
   `src/routes/properties.index.tsx`, `src/lib/transaction.ts`.
4. **Lease in the seeker profile.** Add the lease intent (and `lease_months` /
   `permitted_use`) to the Preferences form, or state plainly it is not offered.
   File: `src/routes/_authenticated/my.tsx`.

### P2 — Residual Lovable code (each its own PR)

5. Remove `@lovable.dev/cloud-auth-js` (zero importers) and re-resolve the
   lockfile against the public registry.
6. Decide MCP's fate explicitly. If kept, leave as-is; if not, delete
   `src/lib/mcp/*`, `src/routes/mcp.ts`,
   `src/routes/[.well-known]/oauth-protected-resource.ts`,
   `src/routes/[.]lovable.oauth.consent.tsx`, `.lovable/` and the dependency
   together (Tier 3).
7. Replace `@lovable.dev/vite-tanstack-config` with a direct TanStack/Vite config
   (Tier 3). Preserve SSR, the `src/server.ts` entry and the CSRF/error
   middleware in `src/start.ts`.
8. Point the default AI gateway at a neutral, configurable provider and drop the
   Lovable-only default/headers when the owner no longer needs the fallback.
   Files: `src/lib/assistant/pricing.ts`, `run-id.ts`, `chat.server.ts`.

### P3 — Cleanup and hygiene

9. Delete the verified orphans in §5.1 (one PR, with the import-scan evidence).
10. Clear the formatting debt in a dedicated `bun run lint --fix` PR, then flip
    `continue-on-error: false` for lint (and type-check, already green) in
    `.github/workflows/verify.yml` — as `AGENTS.md` instructs.
11. Fix the ~30 real lint findings from §1 (6 `any`, 2 irregular whitespace, 1
    control regex).
12. Resolve the `0017`/`0018` migration-numbering collision
    (`docs/APPLY_RUNBOOK.md:98–101`).
13. Refresh stale baselines: `docs/TESTING.md:20`, `docs/APPLY_RUNBOOK.md`, and
    fold `docs/archive/roadmap.md` into the tracker or archive it.
14. Wire `src/lib/video.ts` into the property page **or** mark it deferred and
    drop the orphan.

### P4 — Feature completion (only after P1)

15. Decide and document the status of the three feature-flagged surfaces
    (Community, owner submissions, interest requests) before enabling any.
16. Sprint 3 goals from `INDEPENDENCE_PLAN.md` §4: one clean buy/rent/lease
    journey, consolidated navigation, provenance on every listing.

---

## 8. What this assessment did not do

- It did not apply any migration, change any data, deploy, or push to `main`.
- It did not verify live backend state, credentials, deployment or scheduler
  behaviour — those need the owner's environment.
- It did not exercise authenticated journeys (assistant chat, admin CRUD, owner
  submissions) against a real database; those paths are read, not run.
- It did not confirm whether `0021` / `0019` are applied on production, which is
  why items 2 and 3 are gated on item 1.
