<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Data access uses the browser backend client with row-level security; public visibility of listings is enforced in policies (published + permission + not demo), so never rely on UI filters alone.
- Property photos live in a private bucket and are shown via short-lived signed links (workspace blocks public buckets).
- Purchase-cost rates and contact/WhatsApp numbers come from the app_settings table, never hardcoded, so the owner can change them.
- The first account that signs up becomes admin (database trigger); further admins must be granted in user_roles.
- Research engine logic lives in src/lib/research (pure rules in core.ts, I/O in engine.server.ts) and runs with the admin client only from the scheduler route or an admin-checked server function, so agents never run from the browser.
- The hourly scheduler authenticates with a token kept in the private schema and checked by a service-role-only function, because the publishable key is visible to anyone.
- Agents only contact sources marked authorised and enabled, read structured feeds only, and never publish: research output becomes draft, unverified listings without listing permission (test-fixture drafts are also marked demo).
- Every scheduler call is logged in research_ticks; the database job sends X-PropWise-Origin: pg_cron so automatic runs are distinguishable from manual calls to the tick address.
- Feed onboarding (CSV/JSON) requires identity, permission evidence and an ID field mapping; imports go through an admin-checked server function and stay private observations.
- Buyer/renter data lives in buyer_profiles and buyer_reports, owner-only via RLS with admin read; buy/rent maths is pure in src/lib/buyer.ts so it stays testable.
- Agent integrations (MCP) live in src/lib/mcp (one tool per file) and require OAuth sign-in; tools act as the caller under RLS and listing tools re-apply the public-visibility filter so admin callers never leak drafts.
- Public property head metadata and sitemap data use a session-free publishable client with explicit public-visibility filters; this keeps private drafts out of crawler responses while preserving browser-based admin previews.
- The sitemap derives static URLs from required route-level sitemap decisions and paginates public property IDs; private subtrees are excluded and failures return no partial XML.

## AI development system

This section governs how an AI agent contributes code. It is the contract; read it before opening a pull request.

### The two-key rule

No change reaches `main` without both keys:

1. **Machine key** — the `Verify` workflow passes (tests and build).
2. **Human key** — the repository owner approves the pull request.

`main` is production: Lovable builds the live site from it, and commits sync back into the Lovable editor. There is no separate deploy step and no staging environment, so a merge is a release.

### Never, under any circumstances

- Push directly to `main`. Every change goes through a pull request.
- Force push, rebase, amend, or squash commits that are already pushed. This rewrites history on Lovable's side and the owner loses project history.
- Apply database migrations. Write the migration file if asked; the owner runs it.
- Deploy. Lovable deploys.
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
- `LOVABLE_DB_MIGRATION_URL` — can alter the production schema.
- `LOVABLE_CRON_SECRET` and the `private.scheduler_token` value — can trigger the research pipeline.

Safe to use: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and public `VITE_*` values. Keep `.env` and `.env.*` ignored except `.env.example`; hosted runtime and build bindings must supply configuration so credentials are not tracked in Git.

### Checks

`bun run test` and `bun run build` must pass — they gate the pull request.

`bun run type-check` and `bun run lint` are reported but do not block. Type-check **passes** (verified on `main` @ `d96a4ff`). Lint fails on pre-existing formatting debt only: `bun run lint` reports about 3,600 problems, almost all `prettier/prettier`, and they are fixable with `--fix`. Do not fix this debt opportunistically inside an unrelated pull request; it makes the diff unreviewable. Clear it in a dedicated pull request, and flip `continue-on-error` to `false` for each check once it is clean — type-check can be flipped today, lint once the formatting debt is cleared.

### Keep pull requests small

One change per pull request. Three fixes are three pull requests. A large diff cannot be reviewed properly, and review is the only control that catches what the tests miss.

- The help assistant (src/lib/assistant, /api/assistant) verifies the caller's token and saves chats under RLS; AI keys stay server-side.
- Area intelligence uses pure rules and admin-only fetching; rows stay hidden until admin publication.
- Home-screen support uses a manifest and icons only, without offline caches, to preserve preview freshness.
- Public map displays share LocationMap, dynamically importing Leaflet inside an effect; keyless map-layer definitions preserve provider attribution. Public address search uses explicit Photon queries and routing opens OpenStreetMap directions, so the buyer map never requires Google credentials. Legacy owner-only research services require owner migration separately.
