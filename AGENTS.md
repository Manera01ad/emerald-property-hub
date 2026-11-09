<!-- PLATFORM-STATUS:BEGIN -->
> [!IMPORTANT]
> The owner confirms PropWise AI has ALREADY moved away from both Lovable.dev
> and Lovable Cloud. Do not repeat a Lovable exit or database migration audit.
> The canonical product-completion plan is `docs/INDEPENDENCE_PLAN.md`;
> the current code and feature inventory is `docs/CURRENT_STATE.md`.
> `docs/archive/PLAN.md` and `docs/archive/LOVABLE_EXIT.md` are historical references.
>
> Some Lovable-specific packages and files still exist in the repository.
> Treat them as code cleanup candidates only after proving they are unused
> and the independent build continues to pass.
>
> Never rewrite published git history (no force pushing, rebasing, or
> amending commits already pushed). Keep `main` green and deployable.
<!-- PLATFORM-STATUS:END -->

## How agent context works

This file is the contract and the router. Area instructions live in
`.agents/skills/<area>/SKILL.md` using the OpenHands convention (YAML `name` and
`description` frontmatter); both OpenHands and DeepSeek Harness discover them.
Load the skill for an area before changing it. If a skill and this file disagree,
this file wins. Product and operations documents are indexed in `docs/README.md`.

## Architecture invariants

These hold in every change. The Skill column names the file with the detail.

| Area | Invariant | Skill |
| --- | --- | --- |
| Data and RLS | Public listing visibility is enforced by database policies (published + permission + not demo), never by UI filters. Buyer and renter data is owner-only via RLS with admin read. | `supabase-rls` |
| Photos | Property photos live in a private bucket and are shown through short-lived signed links. | `supabase-rls` |
| Pricing config | Purchase-cost rates, contact and WhatsApp numbers come from `app_settings`, never hardcoded. | `supabase-rls` |
| Admin bootstrap | The first signup becomes admin through a database trigger; further admins are granted in `user_roles`. | `supabase-rls` |
| Research | Pure rules live in `src/lib/research/core.ts`, I/O in `engine.server.ts`; the admin client runs only from the scheduler route or an admin-checked server function; sources must be authorised and enabled; output is draft, unverified and never published. | `research-engine` |
| Scheduler | The hourly tick authenticates with a private-schema token checked by a service-role-only function, and every call is logged in `research_ticks` with `X-PropWise-Origin: pg_cron`. | `research-engine` |
| Feed onboarding | CSV/JSON imports require identity, permission evidence and an ID field mapping; they go through an admin-checked function and stay private observations. | `research-engine` |
| Assistant | `/api/assistant` verifies the caller, saves chats under RLS, keeps AI keys server-side and enforces the daily allowance. | `assistant-budget` |
| Buyer maths | `src/lib/buyer.ts` and its neighbours stay pure and testable; `buyer_profiles` and `buyer_reports` RLS is the boundary. | `buyer-maths` |
| MCP | Tools live one per file in `src/lib/mcp`, require OAuth, act as the caller under RLS, and listing tools re-apply the public-visibility filter. | `mcp-integration` |
| Public metadata | Head metadata and sitemap use the session-free publishable client with explicit public filters; private drafts never reach crawlers, and failures return no partial XML. | `public-site` |
| Area intelligence | Pure rules with admin-only fetching; rows stay hidden until an admin publishes them. | `public-site` |
| Maps | Public maps dynamically import Leaflet inside an effect, use keyless layers with attribution, and never require Google credentials. | `public-site` |
| Home screen | Support is manifest and icons only, with no offline caches, so previews stay fresh. | `public-site` |

Three further skills cover process rather than one area:

| Skill | Load when |
| --- | --- |
| `repo-map` | finding where code, tests or configuration live; any change spanning areas |
| `cto-queue` | picking up a CTO work order, preparing a task packet, or changing agent policy |
| `verification` | before opening a pull request, choosing evidence, or running the gates |

## AI development system

This section governs how an AI agent contributes code. It is the contract; read it before opening a pull request.

### The two-key rule

No change reaches `main` without both keys:

1. **Machine key** — the `Verify` workflow passes (tests and build).
2. **Human key** — the repository owner approves the pull request.

`main` is the protected source for the owner's independent deployment.
A merge may trigger a release; never assume an isolated staging environment
exists unless the current deployment settings verify it. The two-key control
remains: a green `Verify` run and the owner's approval. The owner authorizes
production deployment separately from code review.

### Never, under any circumstances

- Push directly to `main`. Every change goes through a pull request.
- Force push, rebase, amend, or squash commits that are already pushed. This rewrites published history and loses project history.
- Apply database migrations. Write the migration file if asked; the owner runs it.
- Deploy. Production deployment is controlled by the owner on the independent host.
- Access production data, or any secret listed under "Secrets" below.
- Approve or merge your own pull request.

### Change tiers

Pick the tier from what the change touches, and follow it. When in doubt, use the higher tier.

| Tier | Scope | What an agent may do |
| --- | --- | --- |
| 0 | Reading, reports, audits | Do it freely |
| 1 | Tests, docs, pure logic in `src/lib/` | Open a pull request |
| 2 | Pages, components, public content, migrations | Open a pull request **with the evidence below** |
| 3 | Auth, payments, scheduler, service-role code, `main` | Nothing — the owner does it |

Tier 3 paths are listed in `.github/CODEOWNERS`.

### Evidence required on a Tier 2 pull request

State plainly, in the description:

1. What problem this solves.
2. What exactly changed.
3. How it was tested.
4. **What was not tested, and what remains uncertain.**
5. Whether it can affect security, data, or the public site.

Point 4 matters most. "I did not exercise the photo-upload path because it needs a live database" is more useful than a confident claim that turns out to be wrong.

### Secrets

Never request, read, or embed these. They are absent from the agent environment on purpose:

- `SUPABASE_SERVICE_ROLE_KEY` — bypasses every row-level security rule.
- `DATABASE_MIGRATION_URL` (was `LOVABLE_DB_MIGRATION_URL`) — can alter the production schema.
- `CRON_SECRET` (was `LOVABLE_CRON_SECRET`) and the `private.scheduler_token` value — can trigger the research pipeline.
- `AI_API_KEY` (was `LOVABLE_API_KEY`) — spends money per assistant message.

Safe to use: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and public `VITE_*` values. Keep `.env` and `.env.*` ignored except `.env.example`; hosted runtime and build bindings must supply configuration so credentials are not tracked in Git.

### Checks

`bun run test` and `bun run build` must pass — they gate the pull request.

`bun run type-check` and `bun run lint` are reported but do not block. Type-check passed in the last repository assessment (`docs/CURRENT_STATE.md`); re-run for each change. Lint has documented pre-existing formatting debt: do not combine repository-wide formatting with functional changes. Do not fix this debt opportunistically inside an unrelated pull request; it makes the diff unreviewable. Clear it in a dedicated pull request, and flip `continue-on-error` to `false` for each check once it is clean — type-check can be flipped today, lint once the formatting debt is cleared.

### Keep pull requests small

One change per pull request. Three fixes are three pull requests. A large diff cannot be reviewed properly, and review is the only control that catches what the tests miss.

Use `.github/PULL_REQUEST_TEMPLATE.md`. The `HUMAN:` section is reserved for the owner; agents must not edit it.
