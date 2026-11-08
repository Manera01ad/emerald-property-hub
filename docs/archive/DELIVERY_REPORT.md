# PropWise AI — Delivery Report

**Date:** 2026-11-01
**Base:** `main` @ `d96a4ff`
**Scope:** Phase 0 (audit), Phase 1 (stabilise, within authorised scope), Phase 2
(intelligence foundation), Phase 3 (product integration, the homepage entry).
Phases 4–8 are not started; §C says why and what they need.

Every claim below is checked against the repository or a test run. Where
something was not verified, it says so.

---

## A. Executive summary

The application was already substantially built. This programme did **not**
rebuild it. It audited it, recorded the true baseline, and delivered the three
things the master directive names that were genuinely absent:

1. **The skill-based intelligence engine.** An unmerged branch
   (`feat/assistant-skills`) already had the right architecture — skill metadata
   in the prompt, full playbook loaded on demand. It had 3 skills and a parser
   that rejected any header field beyond `name` and `description`. This work
   extended it rather than replacing it: the header now carries `version` and a
   `tools` allowlist, and the registry holds **all 17 required skills**.

2. **The AI as the primary homepage entry.** The directive is explicit, and the
   homepage previously led with a property search box. It now leads with an
   "Ask PropWise AI" box, and the assistant's system prompt was widened from
   "help with using the site" to the full consultant scope.

3. **A Services navigation entry**, without which the `/research-services` page
   the assistant points to was unreachable.

**What was not delivered, and why:** the community intelligence loop, the
contributor challenge network and the membership/payment system (Phases 4–6)
are **not started**. The reason is concrete, not a lack of time: all three
depend on database tables that live in `drizzle/pending/` and **have never been
applied** (community, research network, interest requests). Building UI against
tables that do not exist in the live database would produce exactly the
"disconnected prototype" the directive forbids. Those migrations are owner-only
(Tier 3), and the tracker lists them for approval.

**Baseline → now:** 357 tests → 377 on the skill branch, 365 on the homepage
branch. Build and type-check pass throughout. Lint debt is pre-existing and
untouched.

---

## B. Architecture

### One coordinator, many skills

There is a single `streamText` call in `src/lib/assistant/chat.server.ts`. One
model (`openai/gpt-6-astra`), one gateway (Lovable). No agent sprawl.

```
                 ┌──────────────────────────────────────┐
  homepage ──────▶  Ask PropWise AI  (hero, primary)    │
                 └───────────────┬──────────────────────┘
                                 │  entry.ts (pure, tested)
                    signed in ───┴─── signed out
                        │                 │
                   /assistant?q=      /auth?next=/assistant
                        │             (+ sessionStorage park)
                        ▼
        ┌───────────────────────────────────────────────┐
        │  POST /api/assistant   (needs a real session) │
        │  1. token → Supabase client → RLS applies      │
        │  2. daily allowance check (15/day)             │
        │  3. system = instructions + skillIndex()       │
        │  4. streamText, stopWhen: stepCountIs(5)       │
        └───────────────┬───────────────────────────────┘
                        │
        ┌───────────────▼───────────────────────────────┐
        │  Tools (fixed allowlist)                      │
        │   load_skill ──▶ skill body on demand          │
        │   search_listings  get_listing                 │
        │   get_locality_evidence   web_search?          │
        └───────────────┬───────────────────────────────┘
                        │  all run AS THE USER under RLS
                        ▼
        ┌───────────────────────────────────────────────┐
        │  Supabase                                     │
        │   assistant_messages  assistant_search_log     │
        │   area_intelligence   infrastructure_projects  │
        │   properties  (visibility rule re-applied)     │
        └───────────────────────────────────────────────┘
```

### Progressive disclosure, as built

1. The coordinator sees **only** `name: description` per skill (`skillIndex()`).
2. When a question matches a description, the model calls `load_skill`.
3. `load_skill` returns the body — a step of its own, which is why the step
   limit went from 4 to 5.
4. The skill's declared `tools` are informational. The tool set is fixed in
   `tools.ts`; a declaration grants nothing.
5. Every tool call runs as the signed-in user under RLS.

### Why a declaration cannot escalate

A `SKILL.md` is text a contributor can write. The safety comes from three
layers, not from trusting the file:

- **Parse-time:** unknown header keys are rejected; `tools` must be on the
  allowlist; description ≤200 chars, body ≤4000; name must match its folder.
- **Test-time:** a broken skill is skipped at runtime **and fails the test**, so
  it can never reach production quietly. A safety scan rejects links, code
  fences, phone numbers and "ignore the rules" phrasing.
- **Run-time:** the tool set is fixed. There is no dynamic skill installation.

### Evidence handling

Unchanged and already strong. The prompt requires every figure to be labelled
VERIFIED / ESTIMATE / CLAIM / UNKNOWN with a source and date, forbids inventing
listings or prices, and forbids calling a property verified, title-clear,
flood-free or approved. The new skills each restate the relevant part of that.

---

## C. Feature status matrix

| Area | Status | Note |
| --- | --- | --- |
| Repository audit and baseline | **done** | PR #18, `docs/IMPLEMENTATION_TRACKER.md` |
| Skill registry + 17 skills | **done** | PR #19, 377 tests |
| AI as primary homepage entry | **done** | PR #20, 365 tests |
| Services nav entry | **done** | PR #21 |
| Assistant scope widened to consultant | **done** | PR #20 |
| Intelligence gap dashboard | **blocked** | Needs a new table; owner-only migration |
| Community knowledge retrieval in AI | **blocked** | Community tables unapplied |
| Community moderation / expiry / disputes | **blocked** | Same |
| Contributor challenge lifecycle | **blocked** | `0020_local_research_network.sql` unapplied |
| "Help build this" cards | **blocked** | Depends on the above |
| Membership UI + entitlements | **missing** | No page, no plan tables. Payments must stay off |
| Research report ordering + manual fulfilment | **partial** | Buyer workspace and brief exist; no order flow |
| AI cost controls (global budget, cost logging, model routing) | **missing** | Only the 15/day per-user limit exists |
| Admin: AI usage, gaps, challenges, memberships, revenue | **missing** | Existing admin has 15 panels, none of these |
| Payments | **deliberately absent** | Correct — nothing to disable |

---

## D. Pull requests

All four are open against `main`, all CI-green (Verify ✅, Security ✅). They
are independent and can be reviewed in any order.

| PR | Branch | Title | Depends on |
| --- | --- | --- | --- |
| [#18](https://github.com/Manera01ad/emerald-property-hub/pull/18) | `phase0/implementation-tracker` | Add the implementation tracker and correct the stale checks note | — |
| [#19](https://github.com/Manera01ad/emerald-property-hub/pull/19) | `feat/skill-registry` | Expand the assistant skill registry to the required skill set | Builds on `feat/assistant-skills` (`0bb5edb`), which it carries |
| [#20](https://github.com/Manera01ad/emerald-property-hub/pull/20) | `feat/ai-homepage-entry` | Make the AI consultant the primary entry on the homepage | — |
| [#21](https://github.com/Manera01ad/emerald-property-hub/pull/21) | `fix/services-nav-entry` | Link the research services page from the navigation | — |

**Merge order:** #18 first (it is the tracker, docs only). Then #19 — it either
needs `feat/assistant-skills` merged first, or it brings that commit with it.
Then #20 and #21 in any order.

**Note on `feat/assistant-skills`:** PR #19 is based on it, not on `main`.
Either merge that branch first, or merge #19 and it carries the commit.

---

## E. Testing

Exact commands and results, run in this environment (Bun 1.4.4, Node 24):

```
bun install --frozen-lockfile     ok, 879 packages
bun run test                      40 files, 377 tests passed   (PR #19)
bun run test                      40 files, 365 tests passed   (PR #20)
bun run type-check                exit 0
bun run build                     exit 0
bun run lint                      3649 problems, all pre-existing prettier debt
```

Baseline before any change: 39 files, 357 tests, build ok, type-check ok.

New tests added: 20 in `skills.test.ts` (up from 11) and 8 in `entry.test.ts`.

### What is genuinely untested

- **The model choosing the right skill.** Needs a live `LOVABLE_API_KEY`, absent
  here. The registry is proven well-formed; skill *selection* is not proven.
- **The sign-in round trip** from the homepage box. The plan is unit-tested; the
  redirect chain needs a live Supabase session.
- **Anything authenticated** — admin, buyer workspace, photo upload.
- **Any layout at any width.** No browser in this environment.
- **The live database.** Every schema claim is read from SQL, not confirmed
  against the running project.

I did not add tests for PRs #18 and #21: they change docs and one static array.
A test asserting "the nav contains Services" would restate the array without
protecting behaviour.

---

## F. Security

**Resolved / strengthened by this work**

- Skill headers cannot introduce new instruction fields; unknown keys fail.
- Skill `tools` are validated against a fixed allowlist; an unknown tool fails.
- Skills cannot contain links, code fences, phone numbers, or text telling the
  assistant to ignore its rules — enforced by a test over all 17.
- `?q=` on the assistant is bounded to 1000 characters and trimmed.
- The homepage carries no data; it hands a question to the existing
  authenticated endpoint, where the daily allowance and RLS still apply.

**Open, and requiring the owner**

1. **Google Maps browser key** committed in `.env` in Oct 2026 and still in git
   history. Rotate it in Google Cloud Console and restrict it to the PropWise
   domains. This is the highest-priority item in the repository.
2. **Photo-access privacy finding** — the owner previously rejected the
   dismissal. Fixing it touches privileged signing, which is owner-only.
3. **The scheduler** — confirm it exists and targets
   `https://emerald-property-hub.lovable.app/api/public/research/tick`, then
   record the `cron.schedule` statement in a migration.
4. **The live RLS policy set** has not been verified by anyone with database
   access. The SQL looks correct and complete; "looks correct" is not "verified".

**Not claimed:** no legal compliance is asserted anywhere because a technical
control exists. TNRERA, the DPDP Act, tax on report sales, contributor payment
rules and consumer protection all need a qualified human, and the tracker flags
them as open questions rather than answers.

---

## G. Operating costs

**Measured: nothing.** This environment has no `LOVABLE_API_KEY`, so no request
was ever sent to the model. There is no cost data, and I will not present an
estimate as if it were a measurement.

What is known about the cost shape, from the code:

- Every assistant message is one `streamText` call, capped at **5 steps**.
- Each user is capped at **15 messages per day**.
- Prompt size per request = the fixed instructions + one line per skill
  (17 lines) + up to 20 history messages + any loaded skill body (≤4000 chars).
- Skills reduce cost versus inlining every playbook: the metadata index is a few
  hundred tokens, against roughly 20,000 characters of playbook text that is now
  loaded only when needed.

**The gap the directive asks about is real and unfilled:** there is no global
daily budget, no per-request token/cost logging, and no model routing. Until
those exist, a determined user can cost money up to 15 messages a day each, with
no ceiling across users. That is the single most valuable piece of Phase 6 work
after the owner approves it.

---

## H. Founder approvals needed

Only these require owner action. Each is a decision, not a task I can complete.

1. **Rotate the Google Maps browser key.** Security, do this first.
2. **Confirm the research scheduler** and approve recording it in a migration.
3. **Approve promoting the four pending migrations** (`0017`–`0020`) to
   `0019`–`0022`, applying them to a scratch project, and re-checking RLS. This
   is the gate on Phases 4–6.
4. **Resolve the points-vs-money conflict.** `research-network.ts` states
   recognition is points, never money; the directive asks for manual payment
   tracking. Payment work cannot start until this is settled.
5. **Choose a payment provider** (Razorpay is the usual India-compatible choice)
   and approve pricing before any membership or report work begins.
6. **Decide the photo-access fix** approach.
7. **Decide the CSP** — report-only first.
8. **Commission a legal review** before any paid service goes live.
9. **Review and merge the four PRs.**

---

## I. Release checklist

Nothing has been merged, and nothing will be without your approval. To publish:

1. **Review each PR** in the order in §D. PR #20 changes the homepage — look at
   the preview at 375px, 768px and 1440px, since I could not.
2. **Merge PR #18** (docs only). Safe.
3. **Merge PR #19.** If you prefer a linear history, merge
   `feat/assistant-skills` first.
4. **Merge PRs #20 and #21.**
5. **After merging, do one manual pass on the live site:**
   - type a question in the homepage box while signed out, sign in, confirm it
     sends **exactly once**;
   - ask "What should I check before buying a plot in Guduvancheri?" and confirm
     the answer loads the `legal-document-readiness` or `document-check` skill
     and labels its figures;
   - ask about flooding and confirm it refuses to reassure.
6. **Rollback:** every change is a normal commit on `main`. Revert the merge
   commit. No migration, no schema change, no data change is involved, so a
   revert is complete and instant.

Do not enable the community, owner-submission or interest-request flags as part
of this release. They are still off by default and their tables are unapplied.

---

## J. Day-60 business metrics

A dashboard to build, and the events that would feed it. None of this is
instrumented yet — I am listing what to measure, not reporting numbers I do not
have.

| Metric | What it tells you | Where the data would come from | Exists? |
| --- | --- | --- | --- |
| Visitors | Top of funnel | Analytics (not yet installed) | no |
| Assistant questions asked | The core engagement signal | `assistant_messages` where role=user | **yes** |
| Distinct users asking | Depth of use vs curiosity | `assistant_messages` | **yes** |
| Questions per user | Whether people come back | `assistant_messages` | **yes** |
| Skill load rate | Whether the skills earn their place | Needs logging in `load_skill` | no |
| Questions hitting the daily cap | Willingness to pay | 429 responses | no |
| Enquiries | Real intent | `enquiries` | **yes** |
| Report purchases | Revenue proof | No order flow | no |
| Service revenue | Revenue proof | No order flow | no |
| AI cost per question | Unit economics | Needs token logging | no |
| AI cost per paying user | Viability | Needs both | no |
| Community contributions, approved vs rejected | Contribution quality | `community_posts` (unapplied) | no |
| Locality coverage | Whether the evidence base is growing | `area_intelligence`, `infrastructure_projects` | **yes** |

**The day-60 decision the directive asks for** — whether to keep investing —
rests on four numbers, in this order: assistant questions asked, distinct users
asking, enquiries, and report purchases. Only the first three are measurable
today. **Cost per question must be measured before any paid plan is priced**, or
the margin is a guess.
