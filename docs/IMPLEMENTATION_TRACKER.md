# PropWise AI — Implementation Tracker

The single canonical tracker for the PropWise AI development programme. Every
requirement from the master directive is classified here, with evidence. It is
updated as work lands; it is not a plan document.

- **Baseline audited:** `main` @ `d96a4ff`
- **Tracker started:** 2026-11-01
- **Baseline checks:** `bun run test` 39 files / 357 tests pass; `bun run build`
  passes (2.98s); `bun run type-check` passes (exit 0); `bun run lint` 3649
  problems (pre-existing, reported not blocking).
- **Open pull requests at audit time:** none. PRs #1–#17 are all merged.

Status values: **done** (implemented and verified), **partial** (some paths only),
**defective** (present but broken), **missing** (absent), **blocked** (external
dependency or owner-only approval), **n/a** (not required).

---

## 1. How to read this file

The repository already carries a large, high-quality body of documentation:
`docs/PRODUCT_MAP.md`, `docs/FEATURE_INVENTORY.md`, `docs/DATA_FLOW.md`,
`docs/audit-2026-10-29.md`, `docs/architecture-pan-india.md`,
`docs/integration-plan.md` and `docs/runbook.md`. Those are the Phase A audit for
this project and remain authoritative on *existing* functionality. This tracker
is the delivery ledger: it maps the master directive's requirements onto that
reality and records what is done, partial, blocked or missing.

**The governing constraint** (`AGENTS.md`) is that this project has a two-key
release gate: the `Verify` workflow must pass (machine key) **and** the repository
owner must approve the pull request (human key). `main` is production — Lovable
builds the live site from it, there is no staging, so a merge is a release.

---

## 2. Requirement status matrix

### 2.1 Phase 0 — Audit and baseline

| Requirement | Status | Evidence |
| --- | --- | --- |
| Inspect repository | done | 331 tracked files read; see §3 |
| Inspect open pull requests | done | GitHub API: 0 open; #1–#17 merged |
| Inspect branches / skill-loader work | done | `feat/assistant-skills` is the only branch ahead of `main`; see §3.3 |
| Record baseline tests and build | done | 357 tests pass; build passes; type-check passes; lint 3649 (pre-existing) |
| Identify security and deployment blockers | done | See §5 and `docs/audit-2026-10-29.md` |
| Create implementation tracker | done | This file |

### 2.2 Core product — one AI consultant (§3 of the directive)

| Requirement | Status | Evidence / gap |
| --- | --- | --- |
| Assistant answers website-help questions | done | `src/lib/assistant/instructions.ts`, `src/routes/api/assistant.ts` |
| Assistant understands property conversations | partial | Instructions cover buying, renting, leasing, areas, evidence labels and refusal to invent. No valuation, flood-risk, infrastructure-research, comparison or membership skills yet |
| Conversational follow-ups without re-asking | done | Message history persisted (`assistant_messages`, migration 0010), `MAX_HISTORY_MESSAGES = 20` |
| User context with consent and privacy | partial | History is per-user under RLS; no explicit consent capture on the assistant itself |
| Never claim verified facts without evidence | done | Enforced in `instructions.ts`; tools return only published rows |
| AI consultant is the primary homepage entry | **missing** | `src/routes/index.tsx` still leads with a property **search box**; the assistant is a nav item to `/assistant`. Directive requires the AI to be the primary entry |
| Free tools alongside the AI | done | Locality exploration, purchase-cost estimate, compare, calculators all exist |

### 2.3 Single intelligence engine with reusable skills (§4)

| Requirement | Status | Evidence / gap |
| --- | --- | --- |
| One central AI coordinator | done | Single `streamText` call in `src/lib/assistant/chat.server.ts`; one model gateway (`@ai-sdk/openai` via Lovable provider) |
| Reusable skill architecture | **done** | `src/lib/assistant/skills.ts` + `skill-files.ts` + 17 `SKILL.md` playbooks. Delivered on `feat/skill-registry` (PR #19), building on `feat/assistant-skills` |
| Skill definition structure | done | Header carries `name`, `description`, `version`, `tools`; the directive's other fields (triggers, inputs, evidence standards, safety, output, errors, test cases) are headed sections in the body. Unknown header keys are rejected by the parser and fail the tests |
| Progressive disclosure (metadata → load on demand) | done | `skillIndex()` puts only names+descriptions in the prompt; `load_skill` returns the body on demand |
| Backend adapters + permission checks | done | `load_skill` reads no data; `search_listings`/`get_listing`/`get_locality_evidence` run as the caller under RLS and re-apply the visibility rule. Declared `tools` are checked against a fixed allowlist and grant nothing on their own |
| 15 required skills | **done** | 17 skills: property-discovery, rental-lease-intelligence, locality-intelligence, property-valuation, total-purchase-cost, rent-or-buy, flood-water-risk, infrastructure-research, legal-document-readiness, document-check, property-comparison, community-knowledge, research-report, contributor-challenge, membership-entitlement, enquiry-routing, locality-brief |

### 2.4 Human conversation → intelligence loop (§5)

| Requirement | Status | Evidence / gap |
| --- | --- | --- |
| Detect frequent/missing/unanswered demand | missing | `assistant_search_log` records lookups, but nothing aggregates gaps |
| Intelligence Gap Dashboard (admin) | **missing** | No route, no table |
| AI may propose skills/improvements/tasks | missing | No mechanism |
| AI must not autonomously install/modify/deploy/spend | done | No such capability exists; correct by construction |

### 2.5 Property discovery and intelligence (§6)

| Requirement | Status | Evidence |
| --- | --- | --- |
| Search, compare, valuation, locality tools | done | `/properties`, `/compare`, `src/lib/valuation.ts`, `/location-intelligence` |
| Buy, rent and lease from first release | partial | Pure logic done (`transaction.ts`, `rental.ts`, `lease.ts`); the `transaction_type` **column** is pending-migration (`drizzle/pending/0019`) |
| Evidence fields on a listing | done | `docs/FEATURE_INVENTORY.md` §1.2; evidence badges + `src/lib/evidence.ts` |
| Do not fabricate inventory | done | Empty-state copy on `/properties` and homepage; assistant refuses |
| No scraping / access-control bypass | done | Research engine only reads authorised+enabled feeds |
| Demo listings separated from real | done | `is_demo` in the visibility rule |
| Maps / satellite | partial | MapLibre + Google Maps link parsing; Places calls need credentials the agent does not hold |
| Never present AI valuation as certified appraisal | done | Labels and disclaimers present (`src/lib/valuation.ts`, listing copy) |

### 2.6 Community-powered local knowledge (§7)

| Requirement | Status | Evidence / gap |
| --- | --- | --- |
| Build on the existing forum | done | `/community` exists behind `feature_community` (default off) |
| Structured contributions (rent, water, flooding, roads, transport, noise, amenities, infrastructure, general) | partial | `src/lib/community.ts` has categories; tables are in `drizzle/pending/0018_community.sql` (**not applied**) |
| Consent, moderation, evidence, duplicate detection, source dates, expiry, dispute, privacy, abuse reporting, audit history | partial | Moderation rules + audit log exist in code and tests; tables pending-migration; no expiry/revalidation implemented |
| Evidence labels VERIFIED / OFFICIAL SOURCE / COMMUNITY-REPORTED / ESTIMATE / CLAIM / UNKNOWN | partial | VERIFIED, ESTIMATE, CLAIM, UNKNOWN and COMMUNITY-REPORTED are used; **OFFICIAL SOURCE** is not a distinct label in code |
| Do not publish private details / defamatory claims | done | Moderation rules and assistant instructions forbid it |
| AI cites approved community info with a label | missing | `get_locality_evidence` reads `area_intelligence` + `infrastructure_projects` only; no community retrieval tool |

### 2.7 Contributor and challenge network (§8)

| Requirement | Status | Evidence / gap |
| --- | --- | --- |
| Challenge lifecycle Draft→…→Paid | partial | `src/lib/research-network.ts` has statuses and pure rules + tests. Tables only in `drizzle/pending/0020` (**not applied**) |
| Public contributor UI | **missing** | No route and no admin panel for tasks, evidence review or rewards (`docs/FEATURE_INVENTORY.md` §6.4) |
| "Help build this" cards | missing | Does not exist |
| Paid commitments only when funded and approved | n/a (safe) | No payment path exists at all |
| No recruitment/MLM structures | done | Nothing of the kind exists |
| Non-coding contributors supported | partial | Categories in `research-network.ts` cover surveys, verification, translation |
| Reputation foundation without misleading scores | partial | `pointsFor`/`contributorStanding` exist and are tested |

**Conflict to resolve (owner decision):** `research-network.ts` states recognition
is *points, never money*, while the directive asks for *manual payment tracking*.
These conflict. Payment tracking is not built until the owner resolves it.

### 2.8 Research reports and services (§9)

| Requirement | Status | Evidence / gap |
| --- | --- | --- |
| ₹499 one-time research report | partial | `/research-services` lists it as "Coming soon"; no order flow |
| Report sections (requirements, evidence, affordability, comparables, locality, risks, docs, gaps, next steps, sources, limitations) | partial | `src/lib/brief.ts` (due-diligence brief) and `buyer_reports` cover much of this; no single report artefact |
| Reuse report-generation + buyer workspace | done | `src/routes/_authenticated/my.tsx`, `buyer_reports` |
| Manual review and delivery process | **missing** | No workflow |
| Service enquiries (locality, visits, photography, documents, consultations) | partial | `/consult` and `enquiries` exist; no per-service routing |
| Regulated/brokerage services remain disabled | done | Nothing activates them |

### 2.9 Memberships (§10)

| Requirement | Status | Evidence / gap |
| --- | --- | --- |
| Free / Plus ₹499 / Pro ₹999 comparison UI | **missing** | No `/membership` route |
| Plan catalogue, entitlements, quotas, rate limiting, spending caps, usage/cost logs, subscription state, expiry, upgrade/downgrade, cancellation, payment hooks, admin controls, abuse prevention | **missing** | Only `DAILY_MESSAGE_LIMIT = 15` per user exists (`src/lib/assistant/limits.ts`) |
| Enforce permissions server-side | n/a (safe) | No paid access exists, so nothing to enforce yet |
| Live payments disabled until approved | done | Correct — no payment code at all |

### 2.10 Admin Intelligence Control Center (§11)

| Requirement | Status | Evidence / gap |
| --- | --- | --- |
| Extend the existing admin dashboard | done | 5 groups / 15 tabs in `src/routes/_authenticated/admin.tsx` |
| Views: users, AI conversations, AI usage/costs, popular requests, knowledge gaps, skill execution, locality coverage, community, moderation, challenges, reports, orders, memberships, revenue, security alerts, approvals | partial | Listings, enquiries, buyers, visits, partners, research, areas, localities, infra, ranking, submissions, community, overview, commissions, settings exist. **Missing:** AI usage/cost, skill execution, knowledge gaps, challenges, report orders, memberships, revenue, security alerts |
| Distinguish live/draft/experimental/blocked/admin-only | missing | No such taxonomy in the UI |

### 2.11 AI cost control (§12)

| Requirement | Status | Evidence / gap |
| --- | --- | --- |
| Per-user usage limit | done | 15 messages/day, enforced server-side |
| Message size + history caps | done | `MAX_MESSAGE_CHARS`, `MAX_HISTORY_MESSAGES` |
| Step/tool-call limit | done | `stopWhen: stepCountIs(4)` (5 on the skills branch) |
| Request timeout / abort | done | `abortSignal: request.signal` |
| Global daily AI budget | **missing** | No global cap |
| Cost estimates per request | **missing** | No token/cost logging |
| Model routing by complexity | missing | Single fixed model |
| Caching where safe | missing | None |
| Deterministic calcs instead of AI calls | done | Calculators are pure functions, not AI |
| Abuse detection | partial | Daily limit only |
| Admin-configurable budgets | missing | Limits are constants |
| Report measured vs estimated cost separately | missing | Nothing is measured |

### 2.12 Security, privacy, compliance (§13)

See §5 below for the full treatment.

### 2.13 UI/UX (§14)

| Requirement | Status | Evidence / gap |
| --- | --- | --- |
| One coherent product | done | Single app, single nav |
| Recommended primary nav (Ask PropWise AI, Explore Localities, Find Properties, Compare & Calculate, Community, Services, Membership) | partial | Nav has Buy/Rent/Lease, Localities, Community, For owners, Compare, Ask us. **Missing:** a dedicated "Ask PropWise AI" entry, "Services", "Membership" |
| "Help build this" entry point | missing | Does not exist |
| Admin/dev tools out of public UI | done | Admin is behind `/admin` + `has_role` |
| Mobile-first, responsive, accessible, no dead buttons, honest labels | partial | Responsive classes throughout; no browser available in this environment to verify layouts |

### 2.14 Workflow phases (§15)

| Phase | Status |
| --- | --- |
| 0 Audit and baseline | **done** |
| 1 Stabilise | partial — see §4. Most remaining items are Tier 3 (owner-only); the tracker note fix was Tier 2 and is done |
| 2 Intelligence foundation | **done** — skill registry, progressive disclosure, tool allowlist, validation and the 17 required skills are on `feat/skill-registry` (PR #19) |
| 3 Product integration | not started — the AI is not yet the primary homepage entry |
| 4 Community intelligence | not started |
| 5 Contributor network | not started (rules only) |
| 6 Commercial foundation | not started |
| 7 Quality and security | not started |
| 8 Delivery | partial — PRs #18 and #19 open, both CI-green |

---

## 3. What already exists (do not rebuild)

### 3.1 Application

- **Stack:** TanStack Start (SSR) + React 19 + Vite 8, deployed by Lovable from
  `main`. Supabase project `dashpanandamjickoytj` for database, auth and storage.
  Drizzle for migrations, Bun as the package manager, Vitest for tests.
- **Routing:** file-based under `src/routes/`, 36 route files, including
  `src/routes/api/` (assistant + research tick) and `_authenticated/` (admin,
  my, assistant).
- **Data access:** three clients — browser (RLS applies), service-role
  (server-only, bypasses RLS), session-free publishable (sitemap/head metadata).
  The split is correct and documented in `docs/DATA_FLOW.md` §1.
- **The one rule:** a listing is public only when
  `status='published' AND listing_permission=true AND is_demo=false`, expressed
  once in SQL and mirrored in `src/lib/visibility.ts`. Every public path
  re-applies it.

### 3.2 Existing feature surface

Working: property search and detail, compare (max 4), map/explore, buy/rent/lease
transaction model (pure logic), buyer/renter workspace with calculators and
downloadable reports, locality intelligence with sources, infrastructure
projects, ranking, research engine (pure core + server I/O), feed onboarding,
MCP tools, help assistant, SEO/sitemap, admin dashboard with 15 panels.

Gated (flag off by default): community, owner submissions, interest requests.

Pending-migration (code present, tables not applied): community,
interest requests, buy/rent/lease columns, local research network.

### 3.3 The skill-loader branch — the foundation for Phase 2

`origin/feat/assistant-skills` (commit `0bb5edb`, based directly on current
`main`, 1 commit ahead, 0 behind) adds:

- `src/lib/assistant/skills.ts` — pure parser/loader: front-matter
  `name`+`description`, body limits (`MAX_DESCRIPTION_CHARS=200`,
  `MAX_BODY_CHARS=4000`), folder/name match, unknown header keys rejected,
  `skillIndex()`, `withSkills()`, `findSkill()`.
- `src/lib/assistant/skill-files.ts` — `import.meta.glob` build-time load; a
  broken skill is skipped at runtime and fails the test.
- `src/lib/assistant/skills/<name>/SKILL.md` — three playbooks.
- `load_skill` tool in `tools.ts`; `chat.server.ts` uses `withSkills` and raises
  the step limit from 4 to 5.
- `skills.test.ts` — 122 lines covering parse rules and a safety scan (no links,
  no code fences, no phone numbers, no "ignore the rules" phrasing).

**Assessment:** the architecture matches the directive's progressive-disclosure
requirement almost exactly, and it is well tested. The correct action is to
**extend this branch**, not to build a competing registry. The main gap is that
the header parser rejects unknown keys, so the directive's richer skill metadata
(triggers, tools, permissions, evidence standards, version) cannot be expressed
until the parser is extended.

### 3.4 Branches that are already merged

Every other remote branch (`integration/unify-propwise`, `phase1-buyer-first`,
`fix/*`, `docs/audit-and-runbook`, `ai/*`, `db/*`, `lovable-sync`) is fully
contained in `main`. There is no overlapping work to reconcile.

---

## 4. Directive Phase 1 mapped onto the existing P0/P1 list

`docs/audit-2026-10-29.md` §8 already contains a prioritised fix list. Mapping it
onto the change tiers in `AGENTS.md`:

| # | Item | Tier | Action |
| --- | --- | --- | --- |
| P0-1 | Rotate the Google Maps browser key; merge secret-scan allowlist | **3** | Owner only |
| P0-2 | Confirm the hourly scheduler exists and targets the right URL; record `cron.schedule` in a migration | **3** | Owner only (migration + database) |
| P0-2 | `GET` on the tick route returns 405 | done | Already fixed — PR #16 |
| P0-3 | External uptime check + research heartbeat alert | 2/3 | External service; owner decision |
| P1-4 | Backup and rollback procedure | done | `docs/runbook.md` (PR #7) |
| P1-5 | Fix misleading `r.status` in `runAgent`; add orchestration tests | 1/3 | `src/lib/research/` is owner-gated (Tier 3) |
| P1-6 | Fix the `0012` numbering collision | done | Removed in PR #14 |
| P1-6 | Correct the stale `AGENTS.md` / `verify.yml` statements about type-check | **Tier 2** | **Do this** — it is docs/config and currently misleading |
| P2-7 | City/state model | 2/3 | Draft migration `0014` already applied; code work is Tier 2 |
| P2-8 | Test the anonymous enquiry path end to end | 3 | Needs production access |
| P2-9 | Decide the CSP | 2/3 | Owner decision, then implement report-only |

**Conclusion for Phase 1:** almost every remaining "critical defect" in this
repository is **Tier 3** (auth, payments, scheduler, service-role, migrations,
`main`) and therefore requires the owner, not an agent. The honest, non-bypassing
action is to document them for owner approval rather than attempt them.

---

## 5. Security review (directive §13)

| Finding | Status |
| --- | --- |
| Google Maps browser key committed in `.env` (Oct 2026), still in git history | **OPEN — owner action.** Rotate in Google Cloud Console and restrict to the PropWise domains |
| Photo-access privacy finding | **OPEN — owner rejected dismissal.** Privileged signing changes are Tier 3 |
| Secret handling | done — `.env` untracked, gitleaks + allowlist in CI |
| Database RLS | done in SQL (every table, role-scoped policies); **live policy set not verified** (no database access) |
| Admin permission boundaries | done — `has_role` RPC, admin checks in server functions |
| AI prompt injection | partial — skill safety scan + "rules above always win"; no formal red-team test |
| Untrusted `SKILL.md` files | done (branch) — parse limits + safety scan; broken skill skipped and test fails |
| Third-party code execution | done — no dynamic skill installation; strict tool allowlist |
| Payment-state manipulation | n/a — no payment code exists |
| Cross-user data leakage | done by design — RLS + service-role confined to server functions |
| File upload validation | **not verified** — photo upload needs a live session |
| Rate-limit bypass | partial — daily assistant limit only; no global budget |
| Unsafe tool execution | done — tools are fixed, typed, and run as the caller |

Legal questions to flag (not to answer): Tamil Nadu real estate regulation
(TNRERA), privacy/DPDP Act, tax on report sales, freelancer/contributor payment
rules, and consumer protection for paid reports. **No legal compliance is claimed
because a technical control exists.**

---

## 6. Owner-only decisions and blockers

1. **Rotate the Google Maps browser key** (security, highest priority).
2. **Confirm the scheduler** exists and targets
   `https://emerald-property-hub.lovable.app/api/public/research/tick`, then
   record the `cron.schedule` statement in a migration.
3. **Promote the four pending migrations** (`0017`–`0020` → `0019`–`0022`),
   apply to a scratch project, re-check RLS, then enable flags one at a time.
4. **Resolve the points-vs-money conflict** in `research-network.ts` before any
   contributor payment work begins.
5. **Payment provider choice** for memberships/reports (Razorpay is the usual
   India-compatible choice) and pricing approval.
6. **Photo-access fix** approach.
7. **CSP decision** (report-only first).
8. **Legal review** of TNRERA, privacy, tax, contributor payments and consumer
   protection before any paid service goes live.

---

## 7. Change log

| Date | Change |
| --- | --- |
| 2026-11-01 | Tracker created; baseline recorded on `main` @ `d96a4ff` |
