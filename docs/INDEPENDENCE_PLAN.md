# PropWise AI — Independent Platform Architecture and Migration Plan

**Decision:** Leave Lovable hosting **and** Lovable Cloud. Keep the current GitHub application and its business logic. Develop through OpenHands pull requests. Target an owner-controlled Supabase project plus Cloudflare Workers.

**Baseline:** 2026-11-06, GitHub `main` at `41de6877b74a6a572472bf0ff55f1a8a922c8835` (latest Verify completed successfully). This is a **repository assessment**, not a production data, authentication, or deployment verification.

> **Stop gate:** The owner has stated that production uses **Lovable Cloud**; independent database access and production backup are not confirmed. The older `docs/PLAN.md` and `docs/LOVABLE_EXIT.md` assert that the Supabase backend is already independently owned. **That assumption is unsafe. Do not follow their database-is-unchanged or cancellation steps.** A tracked Supabase project ID or endpoint is not proof of dashboard ownership or data migration.

## 1. Product objective and v1 boundary

PropWise AI is a Chennai-first, buyer- and renter-led property decision assistant for **buy, rent, and lease**. Users should be able to express requirements, discover permitted and clearly sourced listings, compare prices and total cost, research localities (flood/drainage, transit, schools, infrastructure, accessibility), assess evidence and unknowns, create research briefs, and optionally request help. The single AI consultant is the front door, but never presents unverified facts as certified.

**Phase-1 value:** reliable evidence, comparison, and enquiries for Chennai and nearby markets. Data correctness and human trust take priority over national coverage, unsupported forecasts, automatic scraping, a coin economy, or paid memberships. Community contributions and local research gigs are useful **after** moderation, consent, payouts, and safety controls work.

Evidence types must remain distinct: official source; verified; estimated; claim; community-reported; unknown. Map layers and price estimates must cite their source, geography, and observation date. Do not promise appreciation, flood safety, legal title, or a guaranteed valuation.

## 2. Target architecture

```text
Visitor / buyer / owner / contributor / administrator
               |
     Cloudflare Workers + assets
        TanStack Start / React
               |
     Server routes + server functions
       |         |           |
       |         |           +-- AI orchestrator and skill library
       |         |                -> configurable licensed LLM endpoint
       |         |                -> per-user + global budget gates
       |         +-- Research/ingestion workers, scheduled deliberately
       |               -> permissioned CSV/feed/official/open data
       |               -> observations, sources, evidence, drafts
       +-- Owner-controlled Supabase
               - PostgreSQL + RLS + migration history
               - Supabase Auth + Google OAuth configuration
               - Private storage bucket + short-lived signed URLs
               - User roles, provenance and audit trails
```

**Ownership boundaries:**

| Responsibility | Selected owner / service | Critical rule |
| --- | --- | --- |
| Source, issues, CI | Owner's GitHub repository | No direct push to main; Verify + owner approval |
| Coding | OpenHands, working on short-lived branches | Read AGENTS.md; one objective and one PR at a time |
| Frontend and SSR APIs | Cloudflare Workers (staging, then production) | Preview with *nonproduction* credentials first |
| Database/Auth/Storage | A **new owner-controlled Supabase** project | Never assume Lovable Cloud credentials or database access can be transferred |
| AI | Configurable provider via server-only secrets | Fail closed if budget/reservation is unavailable |
| Maps | Existing Leaflet/OpenStreetMap/attributed layers | No reliance on the previously exposed Google Maps key |
| Backups | Owner-controlled, tested restore copies | Verify database + auth + storage, not just a zip filename |

**No Cloudflare D1 rewrite** in this migration. The app is already built around PostgreSQL, Supabase Auth, storage, RPCs, and RLS; moving those to D1 is a separate expensive redesign.

The newest Cloudflare/TanStack official guides use `@cloudflare/vite-plugin` for native Workers deployment and remove a competing `nitro()` adapter. The prior exit runbook describes a Nitro-based proof of concept. OpenHands must evaluate the **current official adapter**, preserve the project's SSR/custom server behaviour, and prove the build and runtime before choosing. Do not simply paste old configs.

## 3. What exists and what is not proved

**Present in `main`:** TanStack Start/React; source routes; buyer/renter and price calculation logic; AI assistant with reusable skill markdown; research engine; RLS-oriented Supabase clients; verified build/test workflows; `drizzle/migrations` 0000–0018; `drizzle/pending` SQL 0017–0021; scripts/sql-check; maps and admin features. Recent GitHub Verify is green. These are code facts, not proof of production services.

**Still coupled to Lovable:** `vite.config.ts` imports `@lovable.dev/vite-tanstack-config` and `@lovable.dev/mcp-js`; package.json includes those and `@lovable.dev/cloud-auth-js`; the lockfile has historically included Lovable private registry URLs; the AI has a Lovable fallback; related metadata and generated MCP routes remain. Inspect active imports **before** removing anything.

**Unverified/blocked:** ownership and access to current Lovable Cloud data; usable export, backup/restore, auth identity migration, private object storage export; live database schema and application of pending migrations; AI budget RPC; production scheduler; OAuth callbacks; real property feed licensing. Do not mark these done from code or documentation alone.

## 4. Execution plan and acceptance gates

### Gate 0 — Protect production (owner + OpenHands read-only audit)

1. Freeze destructive changes. No direct changes to main, no production SQL, no deletion, no auto-merge, no Lovable cancellation.
2. Inventory live auth users, data tables/row counts, public listings, private file buckets and bytes, scheduled jobs, OAuth providers, secrets (names only), configured domains, and revenue integrations.
3. Find the actual **Lovable Cloud export** controls or contact official Lovable support. Owner previously could not find an export option; do not pretend the export exists. If no database/auth export is available, document what can be extracted lawfully via user-facing APIs and how users will reauthenticate.
4. Confirm a restorable backup of all accessible data and storage; record checksums, row counts, timestamps, and trial restore evidence. No access = **blocked**, not complete.
5. Confirm whether the historic Google Maps browser key has been rotated/revoked and origin/API-restricted; browser keys are exposed by design but leaked historical values must not remain active without appropriate restrictions.

**Exit gate:** owner signs off an inventory, export/restore evidence, and an explicit no-data-loss plan.

### Gate 1 — Independent build, no live data change (OpenHands)

1. Branch from latest main. Preserve routes, core business logic, migrations, and tests.
2. Remove the Lovable Vite wrapper; validate native Cloudflare TanStack Start adapter on a preview only. Maintain server-only import protection and SSR error behaviour. If unavailable, prove an alternative adapter with recorded tests.
3. Decide whether public MCP is actually needed. If not, remove the MCP routes, support files, generated metadata, and `@lovable.dev/mcp-js` **together** in a dedicated PR. If needed, port independently in a separate PR.
4. Remove unused `@lovable.dev/cloud-auth-js` after an import scan. Remove Lovable AI defaults only after configuring a non-Lovable endpoint or a clean 'AI not configured' response.
5. Re-resolve `bun.lock` against the public registry and verify no Lovable private cache domains remain. Never strip packages based only on their names.
6. Add staging environment documentation and tests for no baked-in production backend, no private keys in browser bundles, and no hardcoded Lovable hosts.
7. Require `bun run test`, `bun run build`, typecheck, and Cloudflare preview smoke tests. CI green is necessary, not sufficient.

**Exit gate:** app runs in independent Cloudflare preview with synthetic data or an isolated test backend, using no Lovable service.

### Gate 2 — Owner-controlled backend (owner creates account; agent supplies audited scripts)

1. Create a fresh Supabase project **owned by the user**; choose an appropriate region, billing alert, backups and controlled access. Never write its secrets to GitHub or chat.
2. In a throwaway scratch project, execute the applied migrations in order; reconcile `drizzle/pending` carefully, since filenames overlap and some features may not be deployed. Run SQL/RLS/adversarial tests. Do **not** replay migrations or pending SQL blindly on production.
3. Restore database records from an owner-authorized export with original IDs and relationships, including auth users if a supported safe route exists. If auth export cannot be obtained, plan account re-invitation/re-authentication and avoid broken ownership links.
4. Copy private storage objects, metadata, access policies, and signed-URL logic. Test a real photo access path; an empty bucket is not a migration.
5. Recreate OAuth providers, site URL, redirect allowlist, scheduler secrets/cron if actually required, and least-privilege service settings.
6. Compare source and target table counts, sample records, auth roles, photos and storage checksums. Document exceptions and a rollback decision.

**Exit gate:** independent database, auth, and storage pass restoration and permission tests. Only the owner may execute production-affecting operations.

### Gate 3 — Real product testing (private staging)

Test signed-out visitor, signed-in buyer, owner submission, admin role/RLS, property publication permissions, property photos, comparison, buy/rent/lease inputs and totals, evidence labels, localities/maps, consent, research agent feed authorization, AI limit, scheduler authentication, mobile at 375px, error handling, sitemap and login callbacks. Run fail-closed AI test with `AI_DAILY_BUDGET_INR=0`; enable paid AI only by explicit owner decision. Label feature-flagged/unmigrated functions 'not available yet', not 'live'.

**Exit gate:** owner has staging URL and signed checklist, 0 blocker defects, and a verified rollback route.

### Gate 4 — Cutover, monitor, then cancel Lovable

1. Confirm domain ownership and a fresh backup. Schedule a brief write freeze for the final export/delta synchronization. Record rollback window.
2. Change only the relevant custom-domain routing, after checking auth callbacks, env at build and runtime, DNS/TLS, site URL, asset serving, and SSR API routes. Keep the old site accessible for comparison; avoid two writable production backends.
3. Monitor logs, failed logins, API errors, AI spend and scheduler activity. Validate post-cutover counts.
4. **Only after owner verification** stop Lovable deployments, archive useful editor history, and cancel Lovable. Do not cancel merely because a preview URL opens.

**Exit gate:** production works independently for real accounts and data with a documented recovery path.

### Gate 5 — Feature-complete Chennai release (after migration)

Order by user value: (1) trusted buy/rent/lease discovery and comparison; (2) locality, flood and infrastructure research with sources and dates; (3) AI consultant + human enquiry fallback with enforced cost caps; (4) admin workflow and data ingestion provenance; (5) moderated community and paid contributor tasks only after operational policies; (6) optional reports/riders/negotiation with appropriate legal review. Keep unsupported nationwide rollout, memberships, payments and automated scraping out of the cutover scope.

## 5. File and documentation retention plan

**Keep now:** `AGENTS.md`, `README.md`, `src/routes/`, `src/components/`, `src/lib/` including assistant skills and domain tests, `src/integrations/supabase/` until an audited replacement exists, `drizzle/migrations/`, `drizzle/pending/`, `scripts/sql-check/`, `e2e/`, `.github/workflows/`, `bun.lock` (until safely regenerated), `.env.example` (placeholders only), `docs/ARCHITECTURE.md`, `docs/OPERATIONS.md`, `docs/TESTING.md`, and this plan.

**Candidate removals after replacement and impact scan:** `.lovable/`, the unused Lovable auth package, Lovable build wrapper, Lovable-specific MCP files/routes and package if not needed, stale old-host references, invalid SPA fallback rules, private-registry lockfile pins. A file marked generated is **not** automatically disposable. Do not delete database migrations, tests, RLS policies, assistant skills, or UI components without verifying imports and behavior.

**Documentation policy:** `README.md` is the entry point, `AGENTS.md` is the developer contract, **this file is the authoritative independence plan**, and `docs/LOVABLE_EXIT.md` is a gated procedural checklist. Older audits and status trackers are dated evidence, not current deployment authority. Archive superseded reports in a later docs-only PR after references are checked; do not mass-delete project history.

## 6. OpenHands development contract

- Read `AGENTS.md` first; analyze latest `main`; do not resurrect already merged PRs.
- One small PR per gate or concern. Never direct-push, merge, force-push, deploy, apply production migrations, or read/print secrets.
- Every PR states problem, exact files, test output, tests not run, security/data/public-site impact, rollback, and migration prerequisites.
- First engineering PR: **independent build preview only**, with no production backend changes.
- Second: package/lockfile independence.
- Subsequent PRs: backend schema tests and migration tooling, staging deployment, owner-approved cutover preparation.
- Keep pending SQL pending until owner has a known target project, backup, reviewed sequence and verified smoke tests.

## 7. Definition of done

- Live domain loads without Lovable hosting or `@lovable.dev/*` runtime/build dependencies.
- GitHub clone can install/build/test without Lovable registries.
- Owner controls Supabase dashboard, Auth, backups and storage; live rows and files are reconciled.
- AI and research jobs cannot spend money or mutate data unexpectedly.
- User, owner and admin journeys are verified end-to-end; unknown facts are labeled correctly.
- No exposure of service secrets, no unexplained deletion, and a tested rollback exists.
- Lovable is cancelled only after owner acceptance.

## References

- Existing code and docs: this repository (`main` baseline above).
- Official Cloudflare TanStack Start guide: https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/
- Supabase Knowledge Base: https://supabase.com/kb/troubleshooting/identify-lovable-cloud-or-supabase-backend and https://supabase.com/kb/troubleshooting/cant-access-supabase-project-lovable-cloud
