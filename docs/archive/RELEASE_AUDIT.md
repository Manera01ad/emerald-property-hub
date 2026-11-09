# PropWise AI — Independent Release Audit

**Auditor:** AI agent (OpenHands), acting as independent QA, security and release
auditor. Not the author of most of the code under review.
**Date:** 2026-11-01
**Verdict on "ready to launch":** **No.** See §1.

This is an audit, not a status update. Where the project's own documents claim
something, this report says whether I was able to reproduce that claim myself,
and marks anything I could not verify as unverified rather than passing it.

---

## 1. Executive summary

The founder's claim is that the master system is ready to launch. On the evidence
I gathered, it is not. The application is in good shape — it builds, its tests
pass, its security posture on the paths I could inspect is sound — but three
specific things stand between it and a safe public release, and none of them are
code quality.

**Blocker 1 — a live credential is still in git history.**
`git log -S"AIza"` shows the Google Maps browser key was committed in `.env` and
later untracked (commit `a95f918`, "Untrack .env and ignore it"). Untracking a
file does not remove it from history. Anyone with a clone can read that key.
It must be rotated at the provider, not just removed from the working tree.

**Blocker 2 — four migrations have never been applied, and they gate the features
being announced.**
`drizzle/pending/` holds `0017_interest_requests`, `0018_community`,
`0019_buy_rent_lease` and `0020_local_research_network`. Community, owner
submissions, interest requests, buy/rent/lease as a stored column, and the whole
contributor network depend on them. The tables do not exist in production, so
those features cannot work, whatever the code says.

**Blocker 3 — the memberships and paid-report revenue path does not exist.**
There is no `/membership` route, no plan catalogue, no entitlement check, no
quota, no payment integration and no report order flow. I searched for it
directly (`grep -rl "membership\|entitlement\|subscription"` returns only
Supabase realtime `subscription.unsubscribe` calls). §9 and §10 of the directive
are **missing**, not partial.

Two further findings are worth the owner's attention because they are
user-visible and cheap to fix, and I fixed one of them in this programme:

- The homepage's own listing search was **unreachable at 375px** because a grid
  had no breakpoint prefix. Shipped to production; fixed in PR #22.
- Six filter controls on `/properties` had **no accessible name** for screen
  readers. Shipped; fixed in PR #23.

Neither was caught by the test suite, because jsdom computes neither layout nor
an accessibility tree. That is why I added browser tests (PR #27) — and why I
would not treat a green unit suite as evidence that a UI works.

**What is genuinely solid.** The AI consultant is real and is the homepage entry
point. The skill registry exists with 17 documented skills and progressive
disclosure, enforced by a tool allowlist rather than trust. The assistant
verifies the caller's token before spending money. Listing visibility is enforced
in row-level security, not in the UI. Research agents run only from the
scheduler route or an admin-checked server function. The engineering culture
here is better than the launch claim deserves.

### What I changed

Small, reviewable, one concern per pull request, all CI-green:

| PR | Branch | What |
| --- | --- | --- |
| #24 | `feat/ai-cost-control` | global daily AI spending cap + cost logging |
| #25 | `docs/skill-promise-corrections` | stop two skills promising unavailable things |
| #26 | `feat/contribute-page` | a `/contribute` page that is honest about what is not open |
| #27 | `test/e2e-regression-guards` | browser guards for the two defects that shipped |
| #28 | `feat/evidence-labels` | the two missing evidence labels + the no-promotion rule |
| #29 | `feat/knowledge-gap-dashboard` | admin view of what people asked for and did not get |

I did not touch `main`, did not apply any migration, did not enable any feature
flag, and did not activate any payment path. Those are Tier 3 in `AGENTS.md` and
belong to the owner.

---

## 2. What I verified, and how

Every claim below is something I ran, not something I read.

| Claim | How I checked | Result |
| --- | --- | --- |
| Unit suite passes on `main` | `bun run test` on `main` @ `ba98a59` | 43 files, 392 tests, pass |
| Type-check passes on `main` | `bun run type-check` | exit 0 |
| Build succeeds on `main` | `bun run build` | exit 0 |
| Lint debt is pre-existing | `bun run lint` | 3,680 problems (3,659 errors, 21 warnings), all pre-existing |
| Browser tests pass | `bun x playwright test` on `test/e2e-regression-guards` | 80 passed |
| All six branches pass CI | GitHub Actions API, per branch | Verify + Security green on all six |
| `/contribute` is not yet live | `curl -o /dev/null -w "%{http_code}"` | **404** (correct — PR #26 is unmerged) |
| Live site serves | same | `/` 200, `/research-services` 200, `/community` 200 |
| No `/membership` route | `ls src/routes/ \| grep -i member` | absent |
| No entitlement code | `grep -rl "entitlement\|membership"` | only Supabase realtime `unsubscribe` |
| Maps key in history | `git log -S"AIza" -- .env` | **present** — 4 commits |
| `.env` is untracked now | `git ls-files \| grep '^\.env'` | only `.env.example` |
| Search-log kind mismatch | checked `0012` vs `0017` migrations | **not a bug** — `0017` already widened the CHECK |

That last row is worth stating plainly: I suspected a real defect — `search-log.ts`
declares a `"locality"` kind that migration `0012`'s `CHECK` constraint did not
allow — and on checking, migration `0017_assistant_locality_search.sql` had
already fixed it. I record this because a report that only lists the problems it
found, and never the ones it looked for and did not find, is not an audit.

---

## 3. Feature status matrix

Status is my assessment against the directive, not the tracker's. Where they
differ, the difference is noted.

| # | Directive requirement | Status | Evidence / what is actually missing |
| --- | --- | --- | --- |
| 3 | AI consultant as homepage entry point | **done** | hero is the Ask box; PR #20 merged |
| 3 | Natural property conversation | **done** | `instructions.ts` scope; 17 skills |
| 3 | Follow-ups without re-asking | **done** | history persisted; `MAX_HISTORY_MESSAGES = 20` |
| 4 | One coordinator, not many agents | **done** | single `streamText` call |
| 4 | Skill registry, progressive disclosure | **done** | metadata-only index; `load_skill` loads the body |
| 4 | Tool allowlist, not trust | **done** | declared tools checked against a fixed allowlist |
| 4 | 15 required skills | **done** | 17 present |
| 5 | Knowledge-gap detection | **done (this programme)** | PR #29. Was **missing** |
| 5 | AI must not self-install / self-deploy | **done by construction** | no such capability exists |
| 6 | Search, compare, valuation, locality | **done** | `/properties`, `/compare`, `/location-intelligence` |
| 6 | Buy/rent/lease from first release | **partial** | pure logic done; `transaction_type` column is in pending `0019` |
| 6 | Maps / satellite | **partial** | MapLibre + link parsing; Places needs credentials I do not hold |
| 7 | Community forum | **partial, and not live** | page is flag-gated off; tables are in pending `0018` |
| 7 | Six evidence labels | **done (this programme)** | PR #28. Was **partial** (4 of 6) |
| 7 | AI cites community info with a label | **missing** | no community retrieval tool |
| 7 | Report expiry / revalidation | **missing** | no expiry logic |
| 8 | Challenge lifecycle | **partial** | rules + tests exist; tables in pending `0020` |
| 8 | Public contributor UI | **partial (this programme)** | `/contribute` (PR #26), honest but static |
| 8 | "Help build this" cards | **partial** | described on `/contribute`; no per-feature cards |
| 9 | ₹499 research report | **missing** | `/research-services` says "Coming soon"; no order flow |
| 9 | Manual review and delivery | **missing** | no workflow |
| 10 | Free/Plus/Pro interface | **missing** | no route, no component |
| 10 | Entitlements, quotas, billing state | **missing** | only `DAILY_MESSAGE_LIMIT = 15` per user |
| 10 | Live payments disabled until approved | **done (safe)** | no payment code exists at all |
| 11 | Admin control centre | **partial** | 16 tabs; **now includes** knowledge gaps (PR #29) and AI costs (PR #24) |
| 11 | Live/draft/experimental taxonomy | **missing** | no such distinction in the UI |
| 12 | Per-user usage limit | **done** | 15/day, server-side |
| 12 | Global daily budget | **done (this programme)** | PR #24. Was **missing** |
| 12 | Measured vs estimated cost | **done (this programme)** | labelled per row in PR #24 |
| 12 | Model routing by complexity | **missing** | single fixed model |
| 13 | Secret handling | **partial** | `.env` untracked now; **key still in history** |
| 13 | RLS on every table | **unverified** | written in SQL; I have no database access |
| 13 | Photo-access privacy finding | **open** | owner rejected dismissal; Tier 3 |
| 14 | One coherent product, mobile-first | **partial** | two real mobile/a11y defects shipped; guards added in PR #27 |
| 14 | Membership nav entry | **missing** | no page to link to |

**Counts:** done 14, partial 13, missing 12, unverified 1.

---

## 4. Pull requests

All six are **draft**, CI-green, and based on `main` @ `ba98a59`. None is merged.

| PR | Branch | Files | Merge order note |
| --- | --- | --- | --- |
| #27 | `test/e2e-regression-guards` | 8 | independent |
| #28 | `feat/evidence-labels` | 3 | independent |
| #29 | `feat/knowledge-gap-dashboard` | 5 | independent |
| #26 | `feat/contribute-page` | 5 | **before #25** |
| #25 | `docs/skill-promise-corrections` | 3 | after #26 |
| #24 | `feat/ai-cost-control` | 11 | **apply migration first — see below** |

### The one merge that can break production

PR #24 makes the assistant **fail closed**: if the budget reservation cannot be
made, the paid model call is refused. That is the correct trade — the
alternative is an uncapped bill — but it means merging #24 *before* applying
`drizzle/pending/0021_ai_cost_control.sql` will stop the assistant working in
production.

The owner must either apply the migration first, or merge and apply together. I
deliberately did not invert the default, because a cap that does not cap is not
a cap. If the owner prefers the assistant to keep running before the migration is
ready, that is a one-line change and I will make it — but it should be a
decision, not an accident.

---

## 5. Testing

**Commands run, and results.** These are the exact commands; nothing here is
inferred.

| Command | Branch | Result |
| --- | --- | --- |
| `bun run test` | `main` @ `ba98a59` | **43 files, 392 tests pass** |
| `bun run type-check` | `main` | **exit 0** |
| `bun run build` | `main` | **exit 0** |
| `bun run lint` | `main` | **3,680 problems** (pre-existing) |
| `bun run test` | `feat/ai-cost-control` | 47 files, 451 tests pass |
| `bun run test` | `feat/knowledge-gap-dashboard` | 44 files, 424 tests pass |
| `bun run test` | `feat/evidence-labels` | 45 files, 438 tests pass |
| `bun run test` | `feat/contribute-page` | 44 files, 406 tests pass |
| `bun x playwright test` | `test/e2e-regression-guards` | **80 passed** |
| `bun run type-check` | every branch above | exit 0 |
| `bun run build` | every branch above | exit 0 |
| GitHub Actions `Verify` + `Security` | all six branches | **green** |

### What the new tests actually assert

- **PR #24** (59 tests) — cost estimation, missing usage metadata, unpriced
  models, budget thresholds, the concurrency decision rule, reservation and
  reconciliation, the missing-function path, provider errors, per-user limits.
- **PR #28** (14 tests) — the six-label set, and that `weakerEvidence` is
  commutative and **never ascends**, over every pair of labels.
- **PR #29** (32 tests) — grouping keys, priority arithmetic, sorting stability,
  and that no user id reaches the output.
- **PR #27** (80 browser tests) — the two shipped defects, proved to fail before
  the fix.

### What is NOT tested — and this is the part that matters

I want to be blunt about the limits, because a green suite here is easy to
over-read.

1. **No SQL in this programme has ever run.** There is no Postgres in this
   environment. `reserve_ai_budget`, `reconcile_ai_budget`, the advisory lock,
   the RLS policies, the grants and the new tables in migration `0021` are
   **unverified**. They need review and a run against a scratch database.
2. **The concurrency test models the rule; it does not exercise the lock.**
   `pg_advisory_xact_lock` is the thing that makes the budget safe under
   simultaneous requests, and no test touches it.
3. **The assistant server function is untested.** `chat.server.ts` needs a live
   session and a model. The 401 path, the 429 path and the reconciliation path
   are unverified end to end.
4. **The new admin server function (#29) is untested.** Admin check, service-role
   read and error branch all need a database and an admin session.
5. **Nothing has been read from a real search log.** On a low-traffic site the
   gap panel will correctly show nothing; that path is not exercised on live data.
6. **The 3,680 lint problems are untouched by design.** `AGENTS.md` forbids
   fixing them inside an unrelated PR, and I agree — a 3,600-line formatting diff
   would make every review impossible. They need their own PR.
7. **No browser test covers the new pages or tabs.** `/contribute` and the
   Knowledge gaps tab are verified by static assertions and type-check only.

---

## 6. Security

| Finding | Severity | Status |
| --- | --- | --- |
| Google Maps browser key in git history | **high** | **OPEN — owner only.** Rotate at the provider and restrict to the PropWise domains. Removing the file did not remove the key |
| Photo-access privacy finding | **high** | **OPEN — owner rejected dismissal.** Privileged signing is Tier 3 |
| Four migrations unapplied | **high (release)** | **OPEN — owner only.** Features announced but not functional |
| No membership/entitlement code | **medium** | **OPEN** — nothing to exploit, but the revenue path does not exist |
| AI prompt injection | medium | partial — skill safety scan + "rules above always win"; no red-team test |
| Untrusted `SKILL.md` | low | mitigated — parse limits, safety scan, allowlist, no dynamic install |
| Payment-state manipulation | n/a | no payment code exists |
| Cross-user leakage | low | RLS plus service-role confined to server functions |
| File upload validation | medium | **unverified** — needs a live session |
| Rate-limit bypass | low | per-user limit; global cap added in PR #24 |
| `app_settings` readable by `anon` | **noted** | PR #24 puts the budget in `private.*` precisely to avoid publishing the spending limit |

### Things I checked and found sound

- The assistant **verifies the caller's token** and saves under RLS; AI keys stay
  server-side (`chat.server.ts` lines 46–50).
- Listing visibility is enforced **in policies**, not in UI filters, per `AGENTS.md`.
- Research agents run **only** from the scheduler route or an admin-checked
  server function.
- The scheduler authenticates with a token in the private schema, checked by a
  service-role-only function — the publishable key being public is accounted for.
- `src/integrations/supabase/` is CODEOWNERS-protected, and I did not modify the
  generated types; PR #24 uses one documented cast instead, with RLS as the real
  control.

### Legal questions — flagged, not answered

I am not qualified to assess these, and no technical control substitutes for
legal review:

- TNRERA obligations for any transaction assistance.
- DPDP Act 2023 obligations for the community and contributor data.
- GST and income tax on report sales.
- Contractor and freelancer payment rules for contributor rewards.
- Consumer protection for paid reports.

**No legal compliance is claimed because a technical feature exists.**

---

## 7. Operating costs

**Measured: nothing.** I have no production access and no spend data, so I will
not present an estimate as a measurement.

**Estimated, and labelled as estimates.** The rates and the 88 INR/USD figure in
`pricing.ts` (PR #24) are my assumptions, not confirmed against the current
Lovable AI price list. If they are wrong the **cap still holds** — it counts
tokens and refuses — but the rupee figures displayed to the admin will be wrong.

| Item | Status |
| --- | --- |
| Per-request cost estimate | implemented (PR #24), unverified rates |
| Actual usage logging | implemented when the provider reports usage; labelled `measured` |
| Rows where usage is absent | labelled `estimated`; no token counts are invented |
| Default daily cap | **500 INR/day**, overridable with `AI_DAILY_BUDGET_INR` |
| Model routing by complexity | not implemented |
| Caching | not implemented |

The honest summary: the cap is a real ceiling, the cost figures are indicative.

---

## 8. Founder approvals needed

Only decisions that genuinely require the owner. Everything else I either did or
documented.

1. **Rotate the Google Maps browser key.** Highest priority. It is in git history.
2. **Apply the four pending migrations** (`0017`–`0020`) to a scratch database,
   re-check RLS, then enable flags one at a time.
3. **Decide the PR #24 merge order** — apply `0021` first, or accept the
   assistant stopping until it is applied. Do not merge it by accident.
4. **Add the Playwright step to `.github/workflows/verify.yml`.** I did not touch
   `.github/`; it is protected. Without it, PR #27's tests only run when someone
   remembers.
5. **Resolve the points-vs-money conflict** in `research-network.ts` before any
   contributor payment work begins.
6. **Choose the payment provider** and approve pricing, terms and launch. Nothing
   is activated until then.
7. **Decide the photo-access fix** and the **CSP**.
8. **Commission legal review** before any paid service goes live.

---

## 9. Release checklist

Ordered, with the blocking steps first.

**Before anything else**
1. Rotate the Google Maps key; restrict it to the PropWise domains.
2. Confirm the hourly scheduler targets the correct tick URL, and record the
   `cron.schedule` statement in a migration.

**Merging (owner does this — I may not approve or merge my own PRs)**
3. Merge #27, #28, #29 — independent, low risk, CI-green.
4. Merge #26, then #25.
5. Apply `0021_ai_cost_control.sql` on a branch database. Verify
   `reserve_ai_budget` returns `allowed: false` once the cap is hit. Then merge
   #24.
6. Add the Playwright step to `verify.yml` and confirm it runs on a PR.

**Before announcing any feature**
7. Apply `0017`–`0020`, then enable `feature_community`,
   `feature_owner_submissions`, `feature_interest_requests` **one at a time**,
   checking each in production before the next.
8. Do **not** enable any paid feature. None exists yet.

**Verification after each merge**
9. `bun run test`, `bun run type-check`, `bun run build` on `main`.
10. `bun x playwright test` once the CI step exists.
11. Spot-check `/` and `/properties` at 375px on a real phone.

**Do not**
- Merge #24 before the migration is applied.
- Describe memberships, paid reports or contributor payments as available.
- Treat the green unit suite as evidence the UI works. It is not; two defects
  shipped through it.

---

## 10. Day-60 business metrics

The directive asks for a dashboard. I am reporting what the system can actually
measure today, and marking the rest as not measurable, because a dashboard of
numbers nobody can populate is worse than none.

| Metric | Measurable today? | Source |
| --- | --- | --- |
| Visitors | Not in this repo | needs an analytics service (owner decision) |
| AI conversations | **yes** | `assistant_messages` |
| AI messages per user | **yes** | `assistant_messages` |
| Searches that found nothing | **yes** | `assistant_search_log.result_count` |
| Knowledge gaps | **yes** | PR #29, Knowledge gaps tab |
| AI cost per day | **yes** | PR #24, `ai_usage_log` + AI costs tab |
| Enquiries | **yes** | `enquiries` |
| Report purchases | **no** | no order flow exists |
| Service revenue | **no** | no payment path exists |
| Memberships | **no** | no membership system exists |
| Community contributions | **no** | tables unapplied; flag off |
| Contribution quality | **no** | no verification workflow exists |

**Six of twelve are not measurable, because the underlying features do not
exist.** That is the clearest single statement of where this project actually is.
The day-60 review cannot report revenue on a system that cannot take money.

---

## 11. Closing assessment

The founder asked whether the master system is ready to launch. My answer is no,
and the reasons are specific and fixable: a key to rotate, four migrations to
apply, and a revenue path that has not been built.

What I would say in the project's favour is that the parts which exist are built
carefully. The skill registry uses progressive disclosure rather than dumping
instructions into a prompt. The tool allowlist means a skill cannot grant itself
capabilities. Listing visibility lives in row-level security, so a UI bug cannot
leak a draft. The assistant authenticates before it spends. Those are the choices
of people who expect the code to be attacked, and they are why this audit found
no way to bypass a control — only controls that are not built yet.

The two defects that shipped are the more instructive finding. Both were
user-visible, both were fixed quickly, and neither was visible to a suite of 392
passing tests. The lesson is not that the tests are bad; it is that a passing
suite proves the things the suite checks and nothing else. PR #27 exists so the
next one of these is caught by a machine rather than a visitor.

**Recommended next action:** rotate the key, then apply the migrations. Those two
are the whole of the launch gap for everything already built.

---

*This report was produced by an AI agent (OpenHands) on behalf of the repository
owner. Every test result in it was observed by running the command, not inferred.
Items I could not verify are marked unverified rather than passed.*
