# PropWise AI — Independent Product Architecture & Completion Plan

**Owner decision (2026-11-06): PropWise AI has ALREADY LEFT BOTH Lovable.dev AND Lovable Cloud.** This is a **post-exit product completion plan**, not an instruction to inspect, migrate from, export data from, or cancel Lovable. Respect the owner's completed migration. Investigate Lovable only if a specific, current code dependency is independently demonstrated to block a task.

**Repository:** `Manera01ad/emerald-property-hub`; baseline `main` at `41de6877b74a6a572472bf0ff55f1a8a922c8835`. GitHub's latest `Verify` for that SHA passed. This is a source-and-CI fact; it does not establish the status of every live feature, current credentials, deployment or backend.

**Current direction:** GitHub is the source of truth; OpenHands develops in small PRs; retain the current TanStack Start + React application and PostgreSQL/Supabase-style data access. The repository includes an independent project reference in `supabase/config.toml` and `.env.example`. Confirm live infrastructure only when needed for a *specific* functional test, without redoing Lovable-exit discovery. Cloudflare Workers is the planned/referenced runtime in repository docs; deployment details should follow the actual independently hosted environment.

## 1. Product north star

**PropWise AI:** a Chennai-first decision intelligence platform for **buying, renting and leasing** plots, flats, homes and commercial property. Buyers should understand the full economics, evidence and unanswered questions *before* they act.

The Phase 1 user journey:

1. User opens the AI consultant or searches buy/rent/lease listings.
2. They specify budget, preferred locations, school/commute needs, property type and horizon.
3. PropWise shows permitted listings and locality context with source/date/evidence labels.
4. It calculates total ownership/rental/lease cost, affordability, comparables and uncertainty.
5. It can prepare a readable decision report and offer a voluntary consultation.
6. Owners can submit listings for moderation; admins verify and publish.
7. Research agents import only authorized feeds or official/open data into **draft observations** for human review.

Keep six evidence meanings separate: **official source, verified, estimate, claim, community-reported, unknown**. Never treat an advertisement, user report or model guess as legally verified or guaranteed. Do not claim government projects/flood safety/appreciation without an attributable source, date and scope.

### Now / later scope

**Now:** stable public pages; buy/rent/lease journeys; AI assistant with hard budget; locality intelligence; admin/CRM; owner submissions; honest source and verification labels; authorized data intake; privacy and security.

**Next:** opt-in, moderated neighborhood insights; location research tasks/gigs; practical buyer reports; optional human follow-up.

**Later, only after proven demand and controls:** memberships/coins, paid research network, payments, riders and negotiation support, large-scale rollout. Legal/regulatory review is required before any transaction-like intermediation or paid referral activity.

## 2. Existing architecture to preserve

```text
Buyers / renters / owners / contributors / admins
                     |
             TanStack Start / React 19
       file routes + SSR + API / server functions
             |                |
             |           AI consultant + skills
             |           - assistant/chat.server.ts
             |           - assistant/tools.ts
             |           - assistant/skills/*/SKILL.md
             |           - budget/rate/cost checks
             |
    Supabase-compatible backend (independent)
      PostgreSQL / Row Level Security / RPC
      Authentication + private file storage
             |
    Audited research and contributor pipelines
      authorized feeds -> observations -> draft
         human review -> permitted publication

Code -> GitHub PR -> test/build/security -> owner approval
                                         -> independent deployment
```

**Core trust boundaries (must preserve):**
- Public listings satisfy `status='published' AND listing_permission=true AND is_demo=false` in both RLS and application logic.
- Server-only admin/service credentials do not enter browser bundles.
- Photos remain private with appropriately scoped, short-lived access.
- Research ingestion never auto-publishes and uses only authorized sources.
- AI budget limits and request authentication fail closed, including if a budget reservation RPC is missing.
- Private user data is visible only to its owner or authorized admins.
- Owner-submitted listings require explicit review; AI evidence does not substitute for title/legal verification.

## 3. Current repository facts and open questions

| Area | What is present in code / CI | What remains to test or fix |
| --- | --- | --- |
| Web application | TanStack Start, routes, components, tests | Live user journeys and error paths |
| Database | Drizzle migrations 0000–0018, pending 0017–0021, RLS-oriented client | **Current** database's migration history, role permissions, actual schema |
| AI | Assistant, skill registry, lookup, budget code, tests | Live 503/unavailable cases; verify `reserve_ai_budget` on current backend before applying anything |
| Discovery | Property, transaction and locality code | Buy/rent/lease forms, visible listings, safe empty states |
| Research | Server research engine and feed onboarding | Production scheduler behavior and permissioned feeds |
| Community and tasks | UI/helpers and pending SQL | Whether intentionally disabled; moderation, consent, payout rules |
| Hosting | App build currently imports Lovable wrapper and MCP plugin; independent host is owner-reported | Remove *residual* build/registry dependencies without re-migrating infrastructure |
| Quality | Recent GitHub Verify green | Typecheck/lint debt, e2e browser checks, responsive/accessibility |

Residual `@lovable.dev/*` packages in `package.json`, `vite.config.ts` and possibly lockfile are **cleanup targets**, not proof the user is still using Lovable Cloud. The old provider may remain an optional fallback; explicitly prevent unapproved paid AI calls.

## 4. Implementation sequence for OpenHands

### Sprint 0 — Make the existing project understandable (docs and read-only checks)
- Inventory routes/components/services, feature flags, backend endpoints by **name only**, migrations and active imports.
- Produce a single `docs/CURRENT_STATE.md`: **working, incomplete, disabled, blocked, and obsolete**. Each claim must cite exact file/test evidence; do not infer live status from file existence.
- Inventory dead/duplicate components via import references. Classify candidates, never mass-delete based on filenames.
- Find stale references among `docs/archive/PLAN.md`, `docs/archive/LOVABLE_EXIT.md`, `docs/OPERATIONS.md` and historical audit reports. Prefer one canonical README + architecture + execution tracker. Archive old records rather than destroying evidence.
- Capture `bun run test`, `bun run build`, `bun run type-check`, `bun run lint`, plus optional Playwright; separate pre-existing defects from introduced ones.
- **Exit gate:** owner gets a short accurate inventory and a prioritized PR backlog. No feature rewrite, live changes, deletion or DB modification.

### Sprint 1 — Repair critical functions before cosmetic changes
- Reproduce and classify AI 503 cases in an isolated environment. Read `budget.server.ts`, `chat.server.ts`, `drizzle/pending/0021_ai_cost_control.sql` and current migration metadata; propose a safe fix only after confirming whether required RPC/table exists on the **current backend**. Never automatically apply SQL.
- Confirm login, logout and session persistence; role isolation; listing visibility; owner submission; photo access; buy/rent/lease calculations; admin and enquiry workflows.
- Make unsupported features explicitly say “Not available yet” rather than silently failing.
- Verify rate limits, per-user allowances and global AI budget with tests and fail-closed behaviour.
- **Exit gate:** no critical user-path failures, confirmed with deterministic tests and staging smoke results.

### Sprint 2 — Remove residual Lovable *code* and simplify the build
- Trace imports and runtime dependencies before removal.
- Replace `@lovable.dev/vite-tanstack-config` with a tested independent TanStack build for the existing host. Preserve SSR, server-only boundaries, routing and error wrappers.
- Keep or remove the MCP feature explicitly; if unused, delete plugin-generated routes, support code and `@lovable.dev/mcp-js` together in a dedicated PR.
- Remove unused `@lovable.dev/cloud-auth-js`, historical `.lovable/` metadata and obsolete provider fallbacks only after usage checks. Retain or adapt anything still required by current auth.
- Re-resolve `bun.lock` against the public package registry, ensuring no private Lovable cache URLs remain.
- Re-test independent builds and live/staging routes. Do not change the existing database or deployment account.
- **Exit gate:** reproducible clean-clone install/build and no required Lovable service or registry.

### Sprint 3 — Complete the core decision engine
- One clean buy/rent/lease choice, shared search, price/EMI/rental-yield and up-front cost math, comparable display, map, shortlist, evidence, unknowns and readable report.
- Consolidate duplicate navigation; simplify admin information architecture and keep draft/live/experimental features visibly distinct.
- Attach provenance, dates and permission to every listing/observation. Add tests for demo/nonpublished data invisibility.
- Build human consultation fallback from the AI assistant, without asserting unbuilt premium services.
- **Exit gate:** first-time Chennai buyer/renter can complete a useful journey without admin help.

### Sprint 4 — Operations and controlled expansion
- Verify actual scheduler/cron, logs, budget alerts, backup/restore instructions, runbook, staging-to-production release and rollback.
- Only then enable moderated community contributions and optional paid local research work, with consent, review, abuse handling and legal boundaries.
- Measure searches, no-result queries, consultations, repeated usage, verified listings and per-user AI cost. Prioritize by measured demand.
- **Exit gate:** service is maintainable by the owner with OpenHands, without a full-time engineering team.

## 5. File organization and removal policy

**Keep:** `src/routes/`, `src/components/`, `src/lib/`, assistant skills, `src/integrations/supabase/`, `drizzle/migrations/`, `drizzle/pending/`, `scripts/sql-check/`, `e2e/`, GitHub CI/security rules, `AGENTS.md`, `README.md`, lockfile (until safely regenerated), env **example**, deployment/operations docs, and all regression tests.

**Inspect before removal:** unused UI components; duplicated docs; obsolete hosting URLs; `.lovable/` files; Lovable-only npm packages; unused MCP routes; stale static SPA fallbacks; test fixtures that are no longer referenced. Use `rg`/imports/build output before removal.

**Never casually delete:** migrations, RLS functions, auth adapters, backups, historical SQL, generated router code, source provenance, permission logic, and tests. No blanket cleanups or history rewriting.

**Preferred docs:**
- `README.md` = 1-page entry, setup, current links.
- `AGENTS.md` = OpenHands development and safety contract.
- `docs/INDEPENDENCE_PLAN.md` = **this** canonical architecture and execution plan.
- `docs/CURRENT_STATE.md` = agent-produced live implementation ledger (next PR).
- `docs/OPERATIONS.md` = deployment, recovery, logging, secrets names.
- `docs/ARCHITECTURE.md` = detailed implementation/trust boundaries.
- Historical `docs/archive/PLAN.md` and `docs/archive/LOVABLE_EXIT.md` = archival history, not current actions.

## 6. OpenHands rules and first task

Follow `AGENTS.md`. Work only in feature branches off the latest `main`. One small PR per coherent change. No direct main pushes, deployment, secrets, migrations or production writes. PR descriptions must name problem, files, test output, untested areas, user/security/data impact and rollback. Keep Verify green and require owner approval.

**The next OpenHands task is NOT a Lovable exit inspection.** It is a read-only **current-state inventory + actionable cleanup backlog** followed by short PRs for critical failures and residual build dependencies. Prefer completing working code over opening endless planning loops. Do not ask the owner to repeat solved decisions.

## 7. Completion criteria

PropWise AI is done for its initial Chennai release when:
1. Main flows for buy/rent/lease, discovery, comparison, locality, AI and consultation work in staging and production.
2. Auth, RLS, private media, owner submissions and admin permissions are tested.
3. AI costs are hard limited, degraded gracefully and auditable.
4. Authorized feeds and reports communicate provenance and uncertainty honestly.
5. Code installs, builds and runs from GitHub without any required Lovable package/service.
6. Obsolete files are removed in reviewed PRs; docs describe **today's** system.
7. Owner has a tested backup/rollback procedure and simple release checklist.

**Do not restart an already completed exit. Finish, simplify and operate the existing independent product.**
