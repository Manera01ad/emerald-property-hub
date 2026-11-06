# Operations

Companion to `docs/PLAN.md`. How to run, deploy, verify and recover the site.
The pre-migration runbook is `docs/runbook.md` (backups, restore, health); this
file adds the post-Lovable procedures. Where they overlap, this file wins.

---

## 1. Environment variables

The authoritative list. Private values live only in the host's settings, never
in git.

| Variable | Private | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | no | Supabase project URL (server) |
| `SUPABASE_PUBLISHABLE_KEY` | no | Publishable/anon key (server) |
| `VITE_SUPABASE_URL` | no | Same URL, injected at build time |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | no | Same key, injected at build time |
| `VITE_SITE_URL` | no | Public origin for canonical links and sitemap |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | Server-only; bypasses RLS |
| `CRON_SECRET` | **yes** | Research scheduler token |
| `DATABASE_MIGRATION_URL` | **yes** | Postgres URL, migrations only |
| `AI_API_KEY` | **yes** | Model key; unset = assistant off |
| `AI_BASE_URL` | no | OpenAI-compatible endpoint |
| `AI_MODEL` | no | Model id |
| `AI_DAILY_BUDGET_INR` | no | Rupee cap; `0` stops all AI spend |

Legacy names (`LOVABLE_API_KEY`, `LOVABLE_CRON_SECRET`,
`LOVABLE_DB_MIGRATION_URL`, `LOVABLE_CRON_SECRET_PREVIOUS`) are still read as
fallbacks so an existing deployment keeps working. They can be removed once the
new names are set everywhere.

**Never** put a `SUPABASE_SERVICE_ROLE_KEY` in a `VITE_` variable: `VITE_` values
ship to the browser.

---

## 2. Local development

```sh
bun install
cp .env.example .env      # fill in the public Supabase values
bun run dev               # http://localhost:8080
```

`bun run dev` needs no secrets: the app reads its Supabase config at runtime and
public pages render their structure without a backend.

---

## 3. Build and deploy

```sh
bun run test              # must pass
bun run build             # must pass; writes .output/
npx wrangler deploy --config .output/server/wrangler.json
```

Deploy is gated on `Verify` passing. Never deploy a red build.

---

## 4. Health checks (the "is it healthy?" checklist)

A broken deploy is loud; a stopped scheduler is silent. Check both.

**Page health** — load each of these; expect a real page, no console errors:

- [ ] `/`
- [ ] `/properties`
- [ ] `/properties/<a real id>`
- [ ] `/location-intelligence`
- [ ] `/location-intelligence/<area>`
- [ ] `/map`
- [ ] `/auth`
- [ ] `/sitemap.xml` (returns XML naming your domain)

**Auth health**

- [ ] Email sign-up and sign-in work; the session survives a reload.
- [ ] Google sign-in works (Google provider enabled in Supabase).
- [ ] Sign-out works.

**Assistant health**

- [ ] With no `AI_API_KEY`: the route returns a clean "not configured" message,
      not a crash or a 500 stack.
- [ ] With a key: a normal question answers; a question about unknown data is
      refused rather than invented.

**Scheduler health** (if you use the research engine)

- [ ] POST to `/api/public/research/tick` with the bearer token returns 200.
- [ ] A GET returns 405 (method guard).
- [ ] Recent rows appear in `research_ticks`.

**Uptime** — point a free uptime monitor at `/` and, if you use it, at the tick
endpoint with a GET (which returns 405, proving the route is alive). This also
keeps a free Supabase project from pausing for inactivity.

---

## 5. Backups and restore

Unchanged from `docs/runbook.md`. The database, auth users and the
`property-photos` bucket live in Supabase; backups are a property of that
project's plan. Record the plan's retention in the table in `docs/runbook.md`,
and restore once into a scratch project to prove it works.

The Lovable migration touches **no data**, so no restore should ever be needed
because of it.

---

## 6. Rollback

| Situation | Rollback |
| --- | --- |
| A bad deploy | Redeploy the previous build (Cloudflare keeps deployment history) |
| Phase 2 build config breaks | Revert the config pull request; the app is fine |
| Assistant misbehaving | Set `AI_DAILY_BUDGET_INR=0` (stops all spend) or unset `AI_API_KEY` (off) |
| Assistant spend spike | Set `AI_DAILY_BUDGET_INR=0`; check Admin → AI costs |
| Wrong domain in links | Fix `VITE_SITE_URL` and rebuild |

---

## 7. Secrets hygiene

- Rotate the leaked Google Maps key (decision D5) or delete it (D6).
- Never commit `.env`; `.gitignore` already excludes it.
- If a secret is ever committed, **rotate it** — deleting the line does not
  remove it from history, and rewriting history is forbidden here.
- The `Security` workflow (gitleaks) fails on any new credential. Treat that as
  intended, not as an obstacle.

---

## 8. Migrations

Migrations are never applied by an agent. To apply one:

1. Set `DATABASE_MIGRATION_URL` locally.
2. Review the SQL in `drizzle/pending/`.
3. Apply it yourself, deliberately.
4. Update `docs/PLAN.md` D4 and the feature's status.

Four are pending (`0017`–`0021`). Each gates a feature that otherwise shows "not
open yet". Do not announce a feature before its migration is applied.
