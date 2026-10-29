# PropWise AI — Feature Inventory

Date: 2026-10-29
Audited revision: `main` @ `3cd435a`

Each feature records: **location**, **owner**, **dependencies**, **status** and
the **user journey** it serves. Status is one of:

- **working** — code present, tests pass, reachable.
- **gated** — code present and reachable, switched off by a flag (default off).
- **pending-migration** — code present, but its tables live in
  `drizzle/pending/` and are not in the applied journal.
- **partial** — works for some paths, not all.
- **broken** — a specific, verifiable defect.

"Owner" is the reviewer gate from `.github/CODEOWNERS`; every path defaults to
`@Manera01ad`, so only paths with an extra gate are called out.

---

## 1. Discovery and comparison

### 1.1 Property search — working
- **Location:** `src/routes/properties.index.tsx`, `src/lib/data.ts` (`publicPropertiesQuery`), `src/lib/visibility.ts`.
- **Owner:** default. Visibility rule additionally owner-gated (`/src/lib/visibility.ts`).
- **Dependencies:** Supabase `properties`, `app_settings`, `localities`; `matchProperty` (`buyer.ts`).
- **Journey:** Visitor lands → filters by price, bedrooms, land, approval, availability → sees only published, permitted, non-demo rows.
- **Note:** already accepts `?transaction=buy|rent|lease`.

### 1.2 Property detail — working
- **Location:** `src/routes/properties.$id.tsx`, `src/lib/photo-access.ts`.
- **Dependencies:** `properties`, signed photo URLs (private bucket).
- **Journey:** Visitor opens a listing → sees evidence badges, cost estimate and "Questions to ask on price" (asserted by `public-copy.test.ts`).

### 1.3 Compare — working
- **Location:** `src/routes/compare.tsx`, `src/lib/compare.ts`, `components/TransactionSelector.tsx`.
- **Dependencies:** `MAX_COMPARE = 4` (`constants.ts`).
- **Journey:** Visitor adds up to 4 listings → compares side by side, scoped to one transaction type.

### 1.4 Map explore — working
- **Location:** `src/routes/explore.tsx`, `src/routes/map.tsx`, `src/lib/maplibre.ts`, `src/lib/mapurl.ts`.
- **Dependencies:** MapLibre CDN; `maps.functions.ts` / `places.functions.ts` (owner-gated).
- **Not verified:** Places/connector calls need credentials I do not hold.

### 1.5 Transaction model (buy / rent / lease) — working
- **Location:** `src/lib/transaction.ts`, `src/components/TransactionSelector.tsx`.
- **Dependencies:** columns added by `drizzle/pending/0019_buy_rent_lease.sql`.
- **Status detail:** the pure logic is **working** and fully tested
  (`transaction.test.ts`); the `transaction_type` **column** is pending-migration.
  The code defaults to `buy` for rows written before 0019, so it degrades safely.

---

## 2. Buyer and tenant requirements

### 2.1 Buyer/renter workspace — working
- **Location:** `src/routes/_authenticated/my.tsx`, `src/lib/buyer.ts`.
- **Dependencies:** `buyer_profiles`, `buyer_reports` (migration `0006`).
- **Journey:** Signed-in user saves preferences → runs buy/rent analysis and
  rent-vs-buy → saves and downloads a decision report.

### 2.2 Requirements form — working
- **Location:** `src/components/RequirementsForm.tsx`.
- **Journey:** Visitor enters budget, locality, type, bedrooms and area inline on `/properties`.

### 2.3 Interest requests — pending-migration
- **Location:** `src/lib/interest.ts`, `src/components/InterestRequestButton.tsx` (used by `properties.$id.tsx`).
- **Dependencies:** `drizzle/pending/0017_interest_requests.sql` (widens `enquiries.enquiry_type` to include `interest`).
- **Gating:** `feature_interest_requests`, default **off**.
- **Status detail:** pure logic **working** (`interest.test.ts`); the DB constraint
  that permits an `interest` enquiry row is **pending-migration**.

---

## 3. Owner submissions and moderation

### 3.1 Owner listing submission — pending-migration + gated
- **Location:** `src/routes/owners.tsx`, `src/components/OwnerSubmissionForm.tsx`, `src/lib/submissions.ts`, `src/lib/submissions-data.ts`.
- **Dependencies:** `listing_submissions`, `listing_moderation_log` (migration `0018_owner_submissions.sql` — **applied**), `approve_listing_submission` RPC.
- **Gating:** `feature_owner_submissions`, default **off** → page shows "Not open yet".
- **Status detail:** rules **working** (`submissions.test.ts`); the page is **gated**.

### 3.2 Submission review (admin) — gated
- **Location:** `src/components/admin/Submissions.tsx`.
- **Journey:** Admin reviews a submission → approves (creates a draft property in one transaction) or rejects with a reason.

---

## 4. Community

### 4.1 Threads and posts — pending-migration + gated
- **Location:** `src/routes/community.tsx`, `src/routes/community_.$threadId.tsx`, `src/components/Community.tsx`, `src/lib/community.ts`, `src/lib/community-data.ts`.
- **Dependencies:** `community_threads`, `community_posts`, `community_reports`, `community_moderation_log` (**only in `drizzle/pending/0018_community.sql`**).
- **Gating:** `feature_community`, default **off**.
- **Status detail:** moderation rules **working** (`community.test.ts`); tables **pending-migration**.

### 4.2 Community moderation queue (admin) — pending-migration
- **Location:** `src/components/admin/CommunityQueue.tsx`.
- **Journey:** Admin approves or hides reported posts.

---

## 5. Locality intelligence

### 5.1 Locality index and detail — working
- **Location:** `src/routes/location-intelligence.index.tsx`, `location-intelligence.$area.tsx`, `src/lib/localities.ts`, `localities-data.ts`, `src/lib/area-intel.ts`.
- **Dependencies:** `localities` (migration `0015`), `area_intelligence` (migration `0011`).
- **Journey:** Visitor browses localities → opens one → sees water, parks, transport,
  elevation facts, each labelled with its evidence and its source.

### 5.2 Area intelligence fetch (admin) — working
- **Location:** `src/components/admin/AreaIntel.tsx`, `src/lib/area-intel.functions.ts` (owner-gated server function).
- **Journey:** Admin fetches area data → row is hidden draft → admin publishes.

### 5.3 Infrastructure projects — working
- **Location:** `src/routes/infrastructure.tsx`, `src/components/admin/Infrastructure.tsx`, `src/lib/infrastructure.ts`.
- **Dependencies:** `infrastructure_projects` (migration `0000`, extended by `0009`).

### 5.4 Ranking — working
- **Location:** `src/components/admin/Ranking.tsx`, `src/lib/ranking.ts`.

---

## 6. AI research agents and pipelines

### 6.1 Research engine — working (orchestration untested)
- **Location:** `src/lib/research/core.ts` (pure), `src/lib/research/engine.server.ts` (I/O).
- **Owner:** `/src/lib/research/` and `/src/lib/research.functions.ts` are owner-gated.
- **Dependencies:** `research_sources`, `source_observations`, `price_history`,
  `research_agents`, `research_runs` (migration `0004`), `research_ticks` (`0005`).
- **Journey:** Scheduler (or admin) triggers a run → agents read authorised feeds →
  observations become draft, unverified listings → admin reviews.
- **Status detail:** `core.ts` well tested; **no test** covers `runDueAgents` /
  `runAgent` lease, backoff or cost behaviour (audit §5.5).

### 6.2 Scheduler tick endpoint — working, deployment unverified
- **Location:** `src/routes/api/public/research/tick.ts` (owner-gated).
- **Dependencies:** `private.scheduler_token`, `pg_cron`, `pg_net`.
- **Status detail:** the route is correct and returns 401 without a token; **no
  `cron.schedule` exists in the repository** (audit §5.1).

### 6.3 Feed onboarding — working
- **Location:** `src/components/admin/FeedWizard.tsx` (rendered inside `ResearchAgents.tsx`), `src/lib/listing-import.ts`.

### 6.4 Local research network (contributors) — pending-migration, **no UI**
- **Location:** `src/lib/research-network.ts` (pure rules + `research-network.test.ts`).
- **Dependencies:** `research_contributors`, `research_tasks`, `research_submissions`,
  `research_moderation_log`, `research_rewards` (**only in `drizzle/pending/0020_local_research_network.sql`**).
- **Status:** **rules only**. There is **no route and no admin panel** for
  contributor tasks, evidence review or manual payment tracking. This is **new
  development**, not existing functionality (assignment Phase C).
- **Note:** the rules state recognition is **points, never money**, which conflicts
  with the assignment's "manual payment tracking". Flagged as an open decision.

### 6.5 Help assistant — working (needs a live key)
- **Location:** `src/routes/_authenticated/assistant.tsx`, `src/routes/api/assistant.ts`, `src/lib/assistant/`.
- **Owner:** `/src/routes/api/` is owner-gated.
- **Dependencies:** `assistant_messages` (`0010`), `assistant_search_log` (`0012`), `AI keys server-side`.
- **Not verified:** the model call needs `LOVABLE_API_KEY`.

### 6.6 MCP tools — working
- **Location:** `src/lib/mcp/` (one tool per file), `src/routes/mcp.ts`, OAuth consent route.

---

## 7. CRM, commissions, visits, partners

| Feature | Location | Tables | Status |
| --- | --- | --- | --- |
| Enquiries | `components/admin/Enquiries.tsx`, `components/EnquiryForm.tsx` | `enquiries` | working |
| Site visits | `components/admin/SiteVisits.tsx` | `site_visits` (`0002`) | working |
| Partners | `components/admin/Partners.tsx` | `partners` | working |
| Commissions | `components/admin/Commissions.tsx`, `src/lib/commission.ts` | `commissions` | **broken** — panel had no trigger on `main` (unreachable); fixed in this branch (PRODUCT_MAP §3) |
| Buyers view | `components/admin/Buyers.tsx` | `buyer_profiles`, `buyer_reports` | working |

These are **CRM and admin functionality** that the assignment says to preserve
even when hidden behind simplified navigation. They are all preserved.

---

## 8. Platform features

| Feature | Location | Status |
| --- | --- | --- |
| Auth + roles | `src/lib/auth.ts`, `user_roles`, `has_role` RPC | working |
| First signup becomes admin | DB trigger (migration `0000`) | working (by design) |
| Feature flags | `src/lib/flags.ts`, `use-flag.ts`, `0013_phase1_flags.sql` | working (all default off) |
| Settings panel | `components/admin/SettingsPanel.tsx` | working |
| SEO metadata + sitemap | `src/lib/sitemap.ts`, `sitemap-properties.server.ts` (owner-gated) | working |
| Photo access control | `src/lib/photo-access.ts`, migration `0007` | working |
| Error page + boundary | `src/lib/error-page.ts`, `__root.tsx` | working |
| Valuation | `src/lib/valuation.ts`, `research-services.tsx` | working |

---

## 9. Summary counts

- **Working features:** 24
- **Gated (flag off):** 4 (`community`, `owners`, `submissions` review, `interest`)
- **Pending-migration:** 4 (`community` tables, `interest` constraint, buy/rent/lease
  columns, local research network tables)
- **Broken:** 1 (Commissions tab)
- **New development required:** 1 (contributor research tasks + evidence review +
  payment tracking UI)

---

## 10. What is not verified

- Live database state and which migrations are applied.
- Any authenticated flow (admin CRUD, moderation, assistant).
- Photo upload and signed-link generation.
- The scheduler's existence and target URL.
- Model calls (assistant, area fetch, Places).
