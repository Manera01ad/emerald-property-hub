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
