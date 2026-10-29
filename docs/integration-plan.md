# Integration Plan — Unify PropWise AI

Branch: `integration/unify-propwise`
Base: `main` @ `3cd435a`
Date: 2026-10-29

This is the working plan for Phases B–E. Phase A is `docs/PRODUCT_MAP.md`,
`docs/FEATURE_INVENTORY.md` and `docs/DATA_FLOW.md`. It is deliberately short:
the assignment asks for working integration, not speculative architecture.

---

## 1. Guiding constraint

There is **one** database, **one** auth system, **one** research pipeline and
**one** admin dashboard. Nothing here creates a second copy of any of them.
The work is navigation, wiring and hygiene. Existing URLs, tables and admin
functionality are preserved; unfinished work stays behind its feature flag.

---

## 2. What this branch changes (implemented)

| #   | Change                                                                             | Files                                                                   | Why                                                                                         |
| --- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | Phase A audit docs                                                                 | `docs/PRODUCT_MAP.md`, `docs/FEATURE_INVENTORY.md`, `docs/DATA_FLOW.md` | Make the real state legible                                                                 |
| 2   | Group admin nav into the five required sections **and make Commissions reachable** | `src/routes/_authenticated/admin.tsx`                                   | The trigger set (14) and panel set (15) disagreed; `commissions` had a panel and no trigger |
| 3   | Public nav: Discover (Buy / Rent / Lease) + "My activity"                          | `src/components/SiteHeader.tsx`                                         | The four required public entries; the three Discover links reuse `/properties?transaction=` |
| 4   | Remove the duplicate `0012` migration stub                                         | `drizzle/migrations/0012_assistant_search_log.sql` (deleted)            | Two files shared the `0012` prefix; the stub was an unreferenced placeholder                |

All four are **presentation, docs or repository hygiene**. None changes a
database object, an RLS policy, the visibility rule, the auth boundary or the
scheduler.

---

## 3. Navigation mapping (assignment → implementation)

### Public

| Assignment                   | Implemented                                | Reused, not rebuilt                              |
| ---------------------------- | ------------------------------------------ | ------------------------------------------------ |
| Discover: Buy / Rent / Lease | `/properties?transaction=buy\|rent\|lease` | Existing search page + `TransactionSelector`     |
| Locality Intelligence        | `/location-intelligence` (+ `/…/:area`)    | Existing pages                                   |
| Community                    | `/community`                               | Existing pages, still behind `feature_community` |
| My Activity                  | `/auth` → `/my`                            | Existing buyer/renter workspace                  |

### Admin

| Assignment       | Implemented (existing panels, regrouped)                                   |
| ---------------- | -------------------------------------------------------------------------- |
| Properties       | Listings                                                                   |
| People           | Enquiries, Buyers & renters, Site visits, Partners                         |
| Intelligence     | AI Research Agents, Area intelligence, Localities, Infrastructure, Ranking |
| Community & Work | Submissions, Community                                                     |
| Operations       | Overview, Commissions, Settings                                            |

CRM (enquiries, site visits, partners, commissions) is preserved. Commissions
was **unreachable** before this branch and is now reachable.

---

## 4. Workflows — status (assignment Phase C)

| Workflow                                                                 | Status                          | Where                                                 |
| ------------------------------------------------------------------------ | ------------------------------- | ----------------------------------------------------- |
| Property discovery and comparison                                        | working                         | `/properties`, `/compare`                             |
| Buyer and tenant requirements                                            | working                         | `/properties` form, `/my`                             |
| Owner submissions and moderation                                         | gated + pending tables          | `/owners`, admin Submissions                          |
| Community discussions                                                    | gated + pending tables          | `/community`, admin Community                         |
| Locality intelligence with sources                                       | working                         | `/location-intelligence`, admin Area intelligence     |
| AI research agents                                                       | working, orchestration untested | admin AI Research Agents, `/api/public/research/tick` |
| Admin approval queues                                                    | working                         | admin Submissions, Community, Area intelligence       |
| Contributor research tasks, evidence review, **manual payment tracking** | **new development**             | see §5                                                |

### Distinguishing new development from existing code

**Existing code** (reuse, do not rebuild): everything in §4 except the last row.

**New development required** (does not exist as UI):

1. A contributor surface for `research_tasks` (claim a task, submit evidence).
2. A reviewer surface for `research_submissions` (evidence review).
3. Manual payment tracking for `research_rewards`.

The **rules** for all three already exist and are tested in
`src/lib/research-network.ts`. The **tables** exist only in
`drizzle/pending/0020_local_research_network.sql`. What is missing is the UI.

**Open decision:** `research-network.ts` states recognition is **points, never
money**, while the assignment asks for **manual payment tracking**. Those
conflict. Payment tracking should not be built until the owner resolves it; the
points model is the one the code and tests implement today.

---

## 5. Pending migrations — promotion plan (owner action)

`drizzle/pending/` holds four files whose numbers **collide with already-applied
migrations**:

| Pending file                      | Collides with (applied)              | Promote as                        |
| --------------------------------- | ------------------------------------ | --------------------------------- |
| `0017_interest_requests.sql`      | `0017_assistant_locality_search.sql` | `0019_interest_requests.sql`      |
| `0018_community.sql`              | `0018_owner_submissions.sql`         | `0020_community.sql`              |
| `0019_buy_rent_lease.sql`         | —                                    | `0021_buy_rent_lease.sql`         |
| `0020_local_research_network.sql` | —                                    | `0022_local_research_network.sql` |

Steps for the owner (agents do not apply migrations):

1. Renumber the four files into `drizzle/migrations/` as above.
2. Add the matching `_journal.json` entries and snapshots (`bunx drizzle-kit generate`).
3. Apply to a scratch project first and re-check RLS (§7) before production.
4. Only then turn the three flags on, one at a time (§8).

Until then the code is safe: `transaction.ts` defaults to `buy`, and community,
interest and research-network access go through narrow hand-written shapes
(`community-data.ts`, `submissions-data.ts`) that do not depend on `types.ts`.

---

## 6. Folder ownership (assignment Phase D.1)

`.github/CODEOWNERS` already gives a clear structure and is **kept as is**;
restructuring would move files for no functional gain (Phase D.5).

| Area                         | Path                                   | Gate            |
| ---------------------------- | -------------------------------------- | --------------- |
| Schema and migrations        | `/drizzle/`                            | owner           |
| Supabase clients + auth      | `/src/integrations/supabase/`          | owner           |
| Research engine + server fns | `/src/lib/research/`, `*.functions.ts` | owner           |
| Scheduler + API routes       | `/src/routes/api/`                     | owner           |
| Visibility rule              | `/src/lib/visibility.ts`               | owner           |
| The gate itself              | `/.github/`                            | owner           |
| Everything else              | `*`                                    | owner (default) |

---

## 7. Verify before production (assignment Phase E)

### 7.1 Checks (run on this branch)

| Check      | Command              | Result                                     |
| ---------- | -------------------- | ------------------------------------------ |
| Unit tests | `bun run test`       | 35 files, 333 tests, pass                  |
| Type-check | `bun run type-check` | pass (exit 0)                              |
| Build      | `bun run build`      | pass                                       |
| Lint       | `bun run lint`       | reported, non-blocking (pre-existing debt) |

### 7.2 Permission matrix to exercise

Test each role on each surface. Nothing below was exercised by this branch —
`/admin`, `/my` and `/assistant` are `ssr: false`, so they need a real session.

| Role                 | Surfaces to test                                                                    |
| -------------------- | ----------------------------------------------------------------------------------- |
| Visitor              | `/properties`, `/compare`, `/location-intelligence`, `/sitemap.xml`, enquiry submit |
| Authenticated user   | `/my` (profile + report), `/assistant`, interest request on a listing               |
| Contributor          | research tasks and evidence submission (**UI does not exist yet**)                  |
| Reviewer / moderator | admin Submissions, Community, Area intelligence queues                              |
| Administrator        | all 15 admin panels, incl. the restored Commissions panel                           |

### 7.3 RLS and migration verification (owner, before activation)

1. Confirm every table in `docs/DATA_FLOW.md` §5 has RLS enabled.
2. Confirm the public-visibility rule
   (`status='published' AND listing_permission AND NOT is_demo`) is enforced in
   the policies, not only in the app.
3. Confirm anon can read only the named `app_settings` keys from `0013`.
4. Confirm a buyer never receives owner contact details on any path.
5. Confirm the promoted pending migrations applied cleanly and re-check 1–4.

### 7.4 Release checklist

- [ ] `Verify` workflow green on the integration PR (tests + build).
- [ ] Owner reviews and approves (two-key rule; agents do not merge).
- [ ] Pending migrations promoted, numbered `0019`–`0022`, applied to scratch first.
- [ ] RLS re-checked per §7.3 on the scratch project.
- [ ] Flags enabled one at a time, starting with `feature_owner_submissions`.
- [ ] Uptime check on `/` and a research-pipeline heartbeat live (audit §5.2).
- [ ] Google Maps browser key rotated (audit §7).
- [ ] Rollback path confirmed (`docs/runbook.md`).

---

## 8. Feature flags

| Flag                        | Default | Enable when                                                           |
| --------------------------- | ------- | --------------------------------------------------------------------- |
| `feature_owner_submissions` | off     | migration `0020_*` promoted and Submissions queue tested              |
| `feature_community`         | off     | migration `0020_community` promoted and moderation tested             |
| `feature_interest_requests` | off     | migration `0019_interest_requests` promoted and consent copy approved |

Flags are read through RLS and only the exact value `on` enables a feature, so a
feature never flashes open. **Verified.**

---

## 9. What remains unverified

- Live database state and which migrations are applied.
- Every authenticated flow (admin CRUD, moderation, assistant) — no session.
- The scheduler's existence and target URL.
- Photo upload and signed-link generation.
- Whether a well-formed anonymous enquiry succeeds (audit §6.4).
- The restored Commissions panel renders real rows (needs a live admin session).
- The Discover links render correctly at 375/768/1440 widths (no browser here).
