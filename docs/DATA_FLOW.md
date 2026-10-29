# PropWise AI — Data Flow

Date: 2026-10-29
Audited revision: `main` @ `3cd435a`

This document traces how data moves through the system: who may write it, who
may read it, and which rule enforces it. It is derived from the migration SQL,
the client split under `src/integrations/supabase/`, and the query helpers in
`src/lib/`. Claims are **verified** (read from SQL/code) or **not verified**
(cannot confirm without a live database).

---

## 1. The three clients

| Client | File | Key | RLS | Used by |
| --- | --- | --- | --- | --- |
| Browser | `integrations/supabase/client.ts` | publishable | **applies** | All browser queries |
| Service role | `integrations/supabase/client.server.ts` | service role | **bypasses** | Server functions only |
| Session-free | `lib/public-client.server.ts` | publishable | applies | Sitemap, property head metadata |

**Verified rule:** the service-role client is imported only from server functions
and `.server.ts` modules. The scheduler token lives in the `private` schema and is
checked by a `service_role`-only function.

---

## 2. Public visibility — the one rule

A listing is public only when **all three** hold:

```
status = 'published'  AND  listing_permission = true  AND  is_demo = false
```

Expressed once in SQL (migration `0000`, RLS policies) and mirrored once in
`src/lib/visibility.ts`. Every public path re-applies it explicitly, including
the MCP and assistant tools. **Verified.**

---

## 3. Write flows

### 3.1 Anonymous enquiry (contact form)
```
Visitor → EnquiryForm → enquiries (INSERT as anon)
   RLS: status='new' AND admin_notes IS NULL AND consent=true
        AND enquiry_type <> 'interest'   (added by pending/0017)
```
- **Verified:** policy text in migration `0002`; the `enquiry_type <> 'interest'`
  guard is in `drizzle/pending/0017_interest_requests.sql`.
- **Not verified:** whether a well-formed anonymous insert succeeds end to end
  (audit §6.4).

### 3.2 Interest request (signed-in, on a listing)
```
Buyer → InterestRequestButton → enquiries (INSERT as authenticated)
   RLS: enquiry_type='interest' AND auth.uid() IS NOT NULL AND consent=true
        AND property_id IS NOT NULL AND consent_version IS NOT NULL
        AND status='new' AND admin_notes IS NULL
```
- **Source:** `drizzle/pending/0017_interest_requests.sql`. **Pending-migration.**
- Owner contact details are **never** returned to a buyer on any path.

### 3.3 Owner submission
```
Owner → OwnerSubmissionForm → listing_submissions (INSERT as authenticated)
   → admin reviews → approve_listing_submission() RPC
        → creates properties row (draft) + marks submission approved, in one transaction
```
- **Source:** migration `0018_owner_submissions.sql` (**applied**), `src/lib/submissions-data.ts`.
- The RPC runs with elevated rights; the client cannot set status or reviewer fields.

### 3.4 Community post
```
User → NewThreadForm / reply → community_threads / community_posts (INSERT)
   → status 'pending' until a moderator approves
   → three reports hide a post until reviewed
```
- **Source:** `drizzle/pending/0018_community.sql`. **Pending-migration.**
- **Gated:** `feature_community`, default off.

### 3.5 Buyer profile and report
```
User → /my → buyer_profiles (upsert, user_id = auth.uid())
                    buyer_reports (insert, owner-only via RLS, admin read)
```
- **Source:** migration `0006_buyer_intelligence.sql`.

### 3.6 Research pipeline (server-side only)
```
pg_cron (in DB, not in repo) → POST /api/public/research/tick (Bearer token)
   → private.scheduler_token check (service_role only)
   → runDueAgents() → runAgent() per due agent
        → reads authorised+enabled research_sources
        → writes source_observations (upsert on source_id, external_id)
        → writes price_history on change
        → writes draft, unverified properties (no listing permission)
        → logs research_ticks (every call, tagged with X-PropWise-Origin)
```
- **Verified:** lease (`lease_until`), 50 s timeout, monthly cost cap, exponential
  backoff, idempotent upserts.
- **Not verified:** the cron job itself (audit §5.1).

### 3.7 Admin area-intelligence fetch
```
Admin → AreaIntel → server function (admin-checked) → area_intelligence (hidden draft)
   → admin publishes → public read
```
- **Source:** migration `0011_area_intelligence.sql`, `src/lib/area-intel.functions.ts` (owner-gated).

---

## 4. Read flows

| Reader | Path | Filter applied |
| --- | --- | --- |
| Visitor | `/properties`, `/properties/:id` | visibility rule + RLS |
| Visitor | `/location-intelligence/:area` | published area rows only |
| Visitor | `/sitemap.xml` | session-free client + visibility rule, private subtrees excluded |
| Crawler | property head metadata | session-free client + visibility rule |
| Signed-in user | `/my` | RLS: own `buyer_profiles`, `buyer_reports` |
| Signed-in user | `/assistant` | RLS: own `assistant_messages`, `assistant_search_log` |
| Admin | `/admin` | admin RPC `has_role`; service role only in server functions |
| MCP caller | `/mcp` | OAuth; tools act **as the caller** under RLS and re-apply the visibility rule |

---

## 5. Table → migration → code map

| Table | Migration | Reached by |
| --- | --- | --- |
| `user_roles`, `partners`, `properties`, `nearby_places`, `infrastructure_projects`, `enquiries`, `commissions`, `app_settings` | `0000` | admin + public |
| `site_visits` | `0002` | admin |
| `research_sources`, `source_observations`, `price_history`, `research_agents`, `research_runs`, `private.scheduler_token` | `0004` | server only |
| `research_ticks` | `0005` | admin |
| `buyer_profiles`, `buyer_reports` | `0006` | `/my`, admin |
| `assistant_messages` | `0010` | assistant |
| `area_intelligence` | `0011` | admin fetch, public read |
| `assistant_search_log` | `0012_assistant_search_log_schema` | assistant |
| `cities`, `areas` | `0014` | locality model |
| `localities` | `0015` | public + forms |
| `listing_submissions`, `listing_moderation_log` | `0018_owner_submissions` | owners + admin |
| `community_threads`, `community_posts`, `community_reports`, `community_moderation_log` | **pending/0018** | community (**pending**) |
| `research_contributors`, `research_tasks`, `research_submissions`, `research_moderation_log`, `research_rewards` | **pending/0020** | rules only, **no UI** |
| `enquiries.enquiry_type='interest'` constraint + `consent_version` | **pending/0017** | interest requests (**pending**) |
| `properties.transaction_type` + rent/lease term columns | **pending/0019** | buy/rent/lease (**pending**) |

**Verified:** `types.ts` (owner-only generated file) contains **no** entries for
`community_threads`, `community_posts` or `interest_requests`, which is why
`community-data.ts` and `submissions-data.ts` reach those tables through
hand-written narrow shapes instead of generated types.

---

## 6. Migration pipeline state

- **Applied journal** (`drizzle/migrations/meta/_journal.json`) ends at
  `0018_owner_submissions`.
- **`drizzle/migrations/`** holds `0000`–`0018` plus a duplicate `0012` stub.
- **`drizzle/pending/`** holds `0017_interest_requests`, `0018_community`,
  `0019_buy_rent_lease`, `0020_local_research_network` — **not in the journal**.
- The repository owner applies migrations; agents never do (`AGENTS.md`).

**Numbering note:** `pending/0017_interest_requests` and the applied
`0017_assistant_locality_search` share the `0017` prefix, and
`pending/0018_community` and the applied `0018_owner_submissions` share `0018`.
Promoting the pending files must renumber them to `0019`–`0022` to avoid a
second collision. See `docs/integration-plan.md`.

---

## 7. Row-level security status

- RLS is enabled on every table with role-scoped policies (**verified** in the
  migration SQL).
- The one widened public-read policy (`0013_phase1_flags.sql`) adds three named
  flag keys to the anon-readable list and leaves the `0008` rule intact.
- **Not verified:** the live policy set. RLS must be re-checked against the
  database before production activation (see the release checklist).

---

## 8. Feature flags in the data flow

| Flag key | Default | Gates |
| --- | --- | --- |
| `feature_community` | off | `/community`, `/community/:threadId`, admin Community queue |
| `feature_owner_submissions` | off | `/owners`, owner submission form |
| `feature_interest_requests` | off | `InterestRequestButton` on a listing |

Flags are read from `app_settings` through RLS (`useFlag`), and only the exact
value `on` enables a feature; missing means off, so a feature never flashes open.
**Verified.**
