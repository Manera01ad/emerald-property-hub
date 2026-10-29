# PropWise AI — Product Map

Date: 2026-10-29
Audited revision: `main` @ `3cd435a` ("Applied 7/10 feature files")
Method: read the tracked source, ran `bun install`, `bun run test`,
`bun run type-check` and `bun run build` on the audited revision.

This map describes what the code actually contains, not what it intends to be.
Every claim is marked **verified** (I read the file or ran the command) or
**not verified** (I could not confirm it without a live session or database).

---

## 1. Product in one paragraph

PropWise AI is a Chennai-first property product built on TanStack Start (SSR) +
React 19 + Supabase. It has three faces:

1. **Public discovery** — search, compare and understand homes across buy, rent
   and lease, with locality intelligence and a moderated community.
2. **Buyer/renter workspace** (`/my`) — requirements, cost calculators, matches
   and saved decision reports.
3. **Admin operations** (`/admin`) — listings, CRM (enquiries, site visits,
   partners, commissions), the AI research engine, area/localities data, owner
   submissions, community moderation and settings.

There is **one** database, **one** auth system and **one** research pipeline.
There are no parallel stacks to merge. The consolidation work is therefore about
**navigation, wiring and hygiene**, not about rebuilding.

---

## 2. Public navigation (target vs current)

The assignment asks for four public entries. The header
(`src/components/SiteHeader.tsx`, verified) exposed **Find**, **Localities**,
**Community**, **For owners**, **Compare** and **Sign in / My research** on
`main` @ `3cd435a`. After this change it exposes the four required entries:

| Target (assignment) | Nav item | Where it leads |
| --- | --- | --- |
| Discover: Buy / Rent / Lease | **Discover: Buy, Rent, Lease** → `/properties?transaction=buy\|rent\|lease` | The same search page, scoped to one transaction type. **Verified** |
| Locality Intelligence | **Localities** → `/location-intelligence` | Index + `/location-intelligence/:area`. **Verified** |
| Community | **Community** → `/community` | Behind `feature_community` (default **off** → "Not open yet"). **Verified** |
| My Activity | **Sign in / My activity** → `/auth` or `/my` | Buyer/renter workspace. **Verified** |

Extra public nav that must be preserved: `/compare` (with a live count badge),
`/consult` ("Ask us"), `/owners` ("For owners") and the footer links
`/properties`, `/location-intelligence`, `/community`, `/owners`, `/privacy`,
`/terms`, `/disclaimer`, `/contact`.

Gap closed: the public nav previously had **no explicit Buy / Rent / Lease
entry**; buy, rent and lease were reached only through the selector *inside*
`/properties`. This was a navigation gap, not a missing feature. The three links
are three entries into the one search page, so they are not three new pages and
no listing logic is duplicated.

---

## 3. Admin navigation (target vs current)

The assignment asks for five admin groups. The dashboard
(`src/routes/_authenticated/admin.tsx`, verified) rendered **14 tab triggers but
15 tab panels** on `main` @ `3cd435a`.

| Target group (assignment) | Tabs (after this change) | Component |
| --- | --- | --- |
| Properties | Listings | `admin/Listings.tsx` |
| People | Enquiries, Buyers & renters, Site visits, Partners | `Enquiries`, `Buyers`, `SiteVisits`, `Partners` |
| Intelligence | AI Research Agents, Area intelligence, Localities, Infrastructure, Ranking | `ResearchAgents`, `AreaIntel`, `Localities`, `Infrastructure`, `Ranking` |
| Community & Work | Submissions, Community | `Submissions`, `CommunityQueue` |
| Operations | Overview, Commissions, Settings | `Overview`, `Commissions`, `SettingsPanel` |

Concrete wiring defect (**verified by extracting the trigger and panel sets**):

- **`Commissions` was unreachable.** A `<TabsContent value="commissions">` panel
  existed and the component was imported, but there was **no**
  `<TabsTrigger value="commissions">`. With 15 panels and 14 triggers, the
  Commissions panel could never be selected. This change adds the missing
  trigger under Operations; the trigger and panel sets are now 15 and 15, with
  no trigger lacking a panel and no panel lacking a trigger.

Everything else in the admin dashboard is reachable. `FeedWizard`,
`ListingImport` and `NearbyFromSources` are **not orphaned**: they are imported
inside `Listings.tsx` and `ResearchAgents.tsx` respectively. **Verified.**

---

## 4. Route inventory

All routes are file-based under `src/routes/`. `ssr: false` on the
`_authenticated` layout means `/admin`, `/my` and `/assistant` serve a shell to
`curl` and guard on the client. **Verified.**

### Public

| Path | File | Sitemap |
| --- | --- | --- |
| `/` | `index.tsx` | yes |
| `/properties` | `properties.index.tsx` | yes |
| `/properties/:id` | `properties.$id.tsx` | per-row |
| `/explore` | `explore.tsx` | yes |
| `/map` | `map.tsx` | (static decision) |
| `/compare` | `compare.tsx` | yes |
| `/location-intelligence` | `location-intelligence.index.tsx` | yes |
| `/location-intelligence/:area` | `location-intelligence.$area.tsx` | yes |
| `/infrastructure` | `infrastructure.tsx` | yes |
| `/advisor` | `advisor.tsx` | yes |
| `/research-services` | `research-services.tsx` | excluded |
| `/consult` | `consult.tsx` | yes |
| `/contact` | `contact.tsx` | yes |
| `/auth` | `auth.tsx` | no |
| `/community` | `community.tsx` | excluded (flag-gated) |
| `/community/:threadId` | `community_.$threadId.tsx` | excluded |
| `/owners` | `owners.tsx` | excluded (flag-gated) |
| `/privacy`, `/terms`, `/disclaimer` | `privacy.tsx`, `terms.tsx`, `disclaimer.tsx` | yes |

### Authenticated (`ssr: false`, redirects to `/auth`)

| Path | File | Purpose |
| --- | --- | --- |
| `/my` | `_authenticated/my.tsx` | Buyer/renter workspace |
| `/assistant` | `_authenticated/assistant.tsx` | Help assistant chat |
| `/admin` | `_authenticated/admin.tsx` | Admin dashboard |

### Machine / infrastructure

| Path | File | Purpose |
| --- | --- | --- |
| `/api/assistant` | `api/assistant.ts` | Assistant chat (token-checked) |
| `/api/public/research/tick` | `api/public/research/tick.ts` | Research scheduler (token-checked) |
| `/mcp` | `mcp.ts` | MCP endpoint (OAuth) |
| `/sitemap.xml` | `sitemap[.]xml.ts` | Sitemap |
| `/.well-known/oauth-protected-resource` | `[.well-known]/oauth-protected-resource.ts` | OAuth discovery |
| `/.lovable/oauth/consent` | `[.]lovable.oauth.consent.tsx` | OAuth consent |

Route reachability was checked by scanning every `Link to="…"` in the source.
Every public route is linked except `/properties/index` and
`/location-intelligence/index`, which are index routes reached by their parent
path. **Verified.**

---

## 5. Feature modules (code ownership)

| Module | Location | What it owns |
| --- | --- | --- |
| Transaction model | `src/lib/transaction.ts` | Buy/rent/lease as one listing with different terms |
| Visibility rule | `src/lib/visibility.ts` | `published AND listing_permission AND NOT is_demo` |
| Buyer intelligence | `src/lib/buyer.ts`, `rental.ts`, `lease.ts`, `deal.ts` | Profiles, calculators, rent-vs-buy, matching |
| Locality intelligence | `src/lib/areas.ts`, `localities.ts`, `area-intel.ts`, `livability.ts` | Areas, locality tiers, area facts |
| Research engine | `src/lib/research/` (`core.ts`, `engine.server.ts`) | Pure rules + I/O for the AI pipeline |
| Local research network | `src/lib/research-network.ts` | Contributor tasks, evidence, recognition (rules only) |
| Community | `src/lib/community.ts`, `community-data.ts` | Threads, posts, moderation rules |
| Owner submissions | `src/lib/submissions.ts`, `submissions-data.ts` | Submission + moderation rules |
| Interest requests | `src/lib/interest.ts`, `components/InterestRequestButton.tsx` | Enquiry of type `interest` |
| Assistant | `src/lib/assistant/` | Chat, tools, search log, limits |
| MCP | `src/lib/mcp/` | One tool per file, OAuth-gated |
| Feature flags | `src/lib/flags.ts`, `use-flag.ts` | Three Phase-1 flags |
| Commission | `src/lib/commission.ts` | Partner commission maths |
| Evidence / verification | `src/lib/evidence.ts`, `verification.ts` | Confidence labels on facts |

Data access is split correctly into three clients: browser (`client.ts`, RLS),
service-role (`client.server.ts`, server only) and session-free
(`public-client.server.ts`, crawlers). **Verified.**

---

## 6. Navigation, layout and shared components

| Component | Role |
| --- | --- |
| `components/SiteHeader.tsx` | Public top nav + footer (`SiteHeader`, `SiteFooter`) |
| `components/NotOpenYet.tsx` | Shown when a flag-gated feature is off |
| `components/TransactionSelector.tsx` | The Buy/Rent/Lease switch |
| `components/PropertyCard.tsx` | Listing card |
| `components/RequirementsForm.tsx` | Buyer/renter requirement capture |
| `components/OwnerSubmissionForm.tsx` | Owner listing submission |
| `components/Community.tsx` | Thread list + new-thread form |
| `components/admin/*` | 18 admin panels (see §3) |

---

## 7. What is duplicated, unused, disconnected or broken

**Verified by reading the tree and running the checks:**

| # | Finding | Severity | Evidence |
| --- | --- | --- | --- |
| 1 | **Migration numbering collision.** Two files share the `0012` prefix: `0012_assistant_search_log.sql` (a 53-byte empty stub) and `0012_assistant_search_log_schema.sql` (the real DDL). Drizzle keys migrations by prefix. | Medium | `wc -c`, `_journal.json` |
| 2 | **Four feature migrations are parked in `drizzle/pending/`** instead of `drizzle/migrations/`: community, buy/rent/lease, local research network, interest requests. The journal stops at `0018_owner_submissions`. | High for completeness | directory listing, `_journal.json` |
| 3 | **`Commissions` tab unreachable.** Trigger set (14) and panel set (15) disagreed: the `commissions` panel existed with no trigger. | Medium | `admin.tsx` trigger/panel extraction |
| 4 | **No explicit Buy/Rent/Lease entry in public nav.** | Low | `SiteHeader.tsx` |
| 5 | **Three Phase-1 flags default to `off`**, so `/community` and `/owners` render "Not open yet". | Informational | `0013_phase1_flags.sql` |
| 6 | **Three code modules have no applied migration**: `community`, `interest_requests` and the local research network tables exist only in `pending/`. Code reaches them through hand-written narrow shapes (`community-data.ts`, `submissions-data.ts`) because `types.ts` (owner-only) does not contain them. | High | `types.ts` grep returns 0 for `community_threads` |

**Not duplicated:** there is exactly one auth system, one database, one research
pipeline, one admin dashboard. No consolidation of those is needed.

---

## 8. What I did not verify

- **The live database.** I read migrations only; I cannot confirm which are
  applied. The pending/migrations split is a repository fact, not a database fact.
- **Authenticated flows.** `/admin`, `/my` and `/assistant` are `ssr: false`; I
  did not sign in, so I did not exercise CRUD, moderation or the assistant.
- **The scheduler.** No `cron.schedule` exists in the repository (see
  `docs/audit-2026-10-29.md` §5.1). Unchanged by this audit.
- **Photo upload / signed links.** Needs a live authenticated session.
