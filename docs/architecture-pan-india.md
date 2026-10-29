# Architecture for 24/7 operation and phased Pan-India expansion

Date: 2026-10-29
Status: recommendation for the owner to approve. Nothing here has been applied.

This document is the design behind the prioritised fix list in
`docs/audit-2026-10-29.md`. It is deliberately conservative: the smallest change
that makes the site reliable, and the smallest change that lets a second city be
added without rewriting Chennai.

## Guiding constraints

1. **`main` is production.** No staging, no separate deploy. Every change must be
   safe to reach users immediately, or be behind a flag that defaults off.
2. **Chennai must keep working.** Every change is additive. No existing column,
   policy, route or feature is removed or renamed.
3. **Additive before structural.** New nullable columns and new tables first. A
   destructive reshape only after the additive version has run in production.
4. **Agents do not touch production data or credentials.** Migrations are written
   by agents and applied by the owner.

---

## Part 1 — Smallest reliable infrastructure change

### What not to change

The current stack is adequate. TanStack Start SSR on Lovable, Supabase for
database, auth and storage, and a database-side cron job is a reasonable shape for
this traffic. There is no evidence of a load problem, and no reason to migrate to
another host, another database, or a separate API tier. A migration would be the
largest risk in this plan for no measured benefit.

### The four small changes that actually matter

**1. Make the scheduler visible and version-controlled.**

The `cron.schedule(...)` call is the one piece of production configuration that
lives outside the repository. Bring it back under version control as a migration
file that the owner applies, and make the tick route reject anything that is not a
POST:

```
GET /api/public/research/tick  ->  405 Method Not Allowed
POST /api/public/research/tick ->  unchanged
```

Why: today a `GET` returns 200 with the SPA shell. A misconfigured scheduler would
look healthy forever. A 405 makes the failure loud.

**2. A dead-man's-switch on the research pipeline.**

The pipeline already writes a row to `research_ticks` on every call. The missing
half is someone being told when rows stop arriving. The smallest version that
works: an external monitor that checks, once an hour, that a tick exists in the
last 2 hours, and alerts if not. Two candidate implementations, in order of
preference:

- A hosted cron/uptime service (for example a scheduled HTTP check) that reads a
  small read-only endpoint returning the age of the last tick. The endpoint must
  be public and must expose no listing or buyer data — only `{ last_tick_at,
  last_tick_ok }`.
- If the owner prefers no new service: a second database job that writes a
  heartbeat row and a monitor that watches the heartbeat. This still needs
  something outside the database to notice silence, so it does not fully solve the
  problem on its own.

**3. Uptime check on the public site.**

One external check on `/` every 5 minutes, alerting on non-200 or on the response
containing "This page didn't load". This is the control that would have caught the
blank-screen incident before a user did.

**4. Written backup and rollback procedure.**

Not code, a document. It must answer: where backups live, how far back they go,
how to restore the whole database, how to restore one table, how to verify a
restore worked, and how to roll back a bad `main` (which, with Lovable, means
reverting the commit on `main`, because Lovable deploys from `main`).

### What to defer

- **A staging environment.** Valuable, but it is a platform decision for the owner
  and not required for reliability today. The additive-change discipline in Part 2
  is the cheaper substitute for now.
- **Read replicas, caching layers, CDN tuning.** No measured need.
- **Moving the research pipeline out of the request path.** The 50 s timeout and
  the lease already bound it; the hourly cadence is not load.

---

## Part 2 — City and state data model

### The problem

`properties.location` is free text and there is no city or state. Chennai is
hardcoded in `areas.ts`, `nearme.ts`, `my-location.ts`, `constants.ts` and page
copy. Adding a second city today means editing all of them, and area names can
collide across cities.

`area_intelligence` already models this correctly with `city` + `area` and
`UNIQUE (city, area)`. The rest should converge on that shape.

### Step 1 — additive columns on `properties` (safe, reversible)

```sql
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS city  text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS area  text;

-- Backfill from the existing free-text location, Chennai only.
UPDATE public.properties
SET city = 'Chennai', state = 'Tamil Nadu', area = location
WHERE city IS NULL;

CREATE INDEX IF NOT EXISTS properties_city_area_idx
  ON public.properties (city, area);
```

Properties of this step:

- `location` stays. Nothing that reads it breaks.
- New rows default to Chennai via a trigger or an explicit default in the insert
  path, so existing forms keep working unchanged.
- No policy changes. The public-visibility rule is untouched, so no draft can
  leak because of this migration.

### Step 2 — a `cities` reference table (safe, additive)

```sql
CREATE TABLE IF NOT EXISTS public.cities (
  slug        text PRIMARY KEY,
  name        text NOT NULL,
  state       text NOT NULL,
  is_active   boolean NOT NULL DEFAULT false,   -- rollout flag, default off
  launched_at timestamptz
);
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active cities" ON public.cities
  FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "admin all cities" ON public.cities
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.cities (slug, name, state, is_active)
VALUES ('chennai', 'Chennai', 'Tamil Nadu', true)
ON CONFLICT (slug) DO NOTHING;
```

`is_active` is the rollout flag. A new city is inserted with `is_active = false`,
its data is loaded and reviewed, and only then is it switched on. That gives a
per-city kill switch without a deploy.

### Step 3 — areas move into the database (the real fix)

Today `AREAS` is a TypeScript literal. That means a new area needs a code change
and a deploy. The target shape:

```sql
CREATE TABLE IF NOT EXISTS public.areas (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_slug text NOT NULL REFERENCES public.cities(slug) ON DELETE CASCADE,
  name      text NOT NULL,
  latitude  numeric NOT NULL,
  longitude numeric NOT NULL,
  UNIQUE (city_slug, name)
);
```

The TypeScript `AREAS` map stays as a seed and as the offline fallback, so
nothing breaks if the table is empty. `areaPoint(city, area)` becomes: read the
table, fall back to the literal. That keeps the current behaviour exactly, and
makes new areas a data change rather than a code change.

### Step 4 — remove the hardcoding (one place at a time)

Order of work, each its own small pull request:

1. `nearme.ts` `areaCentre` — take a city parameter, default `"Chennai"`.
2. `my-location.ts` — take the city from the current route/context, default Chennai.
3. `constants.ts` `MARKETS` — derive from the `areas` table for the active city.
4. Page titles and descriptions — replace the literal "Chennai" with the city name
   from the route or a site setting.

Each step is independently shippable and independently revertible.

### What this does not solve

- **State-level regulation.** Tamil Nadu's stamp duty and registration rates are
  in `app_settings` as single global values. A second state needs per-state rates.
  That is a real change and should be its own design: a `state_settings` table
  keyed by state, with `app_settings` as the fallback. Do not guess the rates for
  another state; the owner must supply them.
- **RERA differences.** `rera_number` is free text and `rera_agent_status` is one
  global setting. Different states have different registries.

Both are reasons to expand one city at a time, with the owner confirming the
regulatory numbers before that city goes live.

---

## Part 3 — Property research pipeline at multi-city scale

The pipeline is already shaped correctly for this: sources are rows, agents are
rows, runs and ticks are logged, and nothing is published automatically. Three
changes make it hold up across cities.

### 3.1 Scope a source to a city

```sql
ALTER TABLE public.research_sources
  ADD COLUMN IF NOT EXISTS city_slug text REFERENCES public.cities(slug);
```

`NULL` means "not city-specific", which preserves current behaviour for every
existing row. The `discovery` agent then filters sources by the cities that are
active, so one city's feeds cannot flood another city's review queue.

### 3.2 Cap work per city, not just per run

`max_items_per_run` is global per agent. With several cities, one busy city can
consume the whole budget. The smallest fix that works without new tables: give
each agent a `max_items_per_city_per_run` and iterate cities in the discovery
loop. This is a code change in `engine.server.ts` plus one column, and it can wait
until there is a second city.

### 3.3 Keep the safety properties exactly as they are

These must not change, and the audit confirmed they hold today:

- Only sources that are `enabled = true` **and** `permission_status = 'authorised'`
  are ever contacted.
- Research output becomes draft, unverified listings without listing permission.
- Test fixtures are marked demo, and demo rows are never public.
- Nothing is published by an agent, ever.

### 3.4 Reliability additions

- **Retry with backoff** already exists in `runAgent` (1h, 2h, 4h, capped at the
  normal interval). Keep it.
- **Add a per-source circuit breaker.** After N consecutive failures for one
  source, pause that source (`enabled = false` with a `paused_reason`) instead of
  retrying it every run. This stops one dead feed from dominating the failure log.
- **Fix the mislabelled status** (§5.4 of the audit) so a failed agent reports
  `failed` all the way to the tick response.

---

## Part 4 — Video-first property experience

### Requirement

Authorised YouTube embeds only. A video must never appear unless the property has
recorded listing permission, and the video must be a deliberate admin action, not
something scraped.

### Design

Add one column, additive and nullable:

```sql
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS video_urls text[] NOT NULL DEFAULT '{}';
```

Store YouTube video IDs or watch URLs. Then, in the app:

1. **A pure parser** (`src/lib/video.ts`) that accepts a YouTube watch URL,
   `youtu.be` link, or bare 11-character ID, and returns a canonical
   `https://www.youtube-nocookie.com/embed/<id>` URL, or `null`. Reject anything
   else. Unit tested, no I/O.
2. **Privacy-enhanced embeds.** Use `youtube-nocookie.com`, not `youtube.com`.
3. **Lazy loading.** The thumbnail loads first; the iframe is created on click.
   This keeps the page fast and avoids loading YouTube on every visit.
4. **Gating.** The player renders only when `hiddenReasons(p).length === 0`, the
   same rule that gates photos. A draft listing cannot show a video, because the
   page already refuses to render the media block for a non-public listing in the
   public view.
5. **Labelling.** A video is owner/developer media, not verification. It must not
   carry a "verified" badge, and the existing `EstimateNote` language about
   unverified information still applies.

### Why not store videos ourselves

Storage cost, transcoding, and bandwidth, for no benefit over an embed. The
existing private `property-photos` bucket stays as it is for stills.

### Admin flow

A field on the existing listing editor: paste one or more YouTube links, the
parser validates them, and an invalid link is rejected with a clear message before
saving. No new page, no new table.

---

## Part 5 — Disclosure: verified vs estimated vs missing

The requirement is that a listing must distinguish what is verified, what is
estimated, and what is missing. The pieces already exist and are used well:

- `VerificationBadge` shows `unverified` / `partially_verified` / `verified`
  (`src/components/Badges.tsx`).
- `EstimateNote` marks estimated figures (`src/components/Badges.tsx`).
- `evidenceFlags` lists missing information (`src/lib/valuation.ts`).
- `hiddenReasons` explains why a listing is not public (`src/lib/visibility.ts`).

What is missing is a single, consistent rule for **which** facts are which, so a
new field cannot quietly be shown as if it were verified. The drafted
`src/lib/verification.ts` is that rule: every listing fact is classified as
`verified`, `estimate`, or `missing`, from the recorded evidence fields
(`verification_status`, `verification_evidence`, `verification_date`,
`verification_expiry`, the `doc_*` flags, `source`).

Two consequences worth stating plainly:

- **Verification expires.** `verification_expiry` exists and the admin table
  already flags an expired date in red. The classification must treat an expired
  verification as `missing`, not `verified`.
- **Estimates must never be labelled as facts.** Asking-price-based figures are
  estimates by definition. The existing note language ("Based on asking prices
  only") is correct and should be preserved.

---

## Part 6 — Rollout sequence

| Phase | Change | Risk | Reversible by |
| --- | --- | --- | --- |
| 0 | Merge PR #6, rotate Maps key | none | revert commit |
| 0 | Tick route rejects non-POST | low | revert commit |
| 0 | Uptime + heartbeat monitoring | none | disable monitor |
| 1 | Backup/rollback doc, runAgent status fix, 0012 rename | low | revert commit |
| 2 | City/state columns + backfill Chennai | low (additive) | drop columns |
| 2 | `cities` and `areas` tables, seeded Chennai | low (additive) | drop tables |
| 2 | Video embed (parser + column + player) | low | revert commit |
| 2 | `verification.ts` disclosure rule | low | revert commit |
| 3 | Remove Chennai hardcoding, one file at a time | low each | revert each |
| 4 | Second city: insert inactive, load data, review, activate | medium | set `is_active = false` |
| 5 | Per-state duty rates | medium | restore global settings |

Phase 4 is where the owner's judgement is required most: the regulatory numbers,
the source permissions, and the go/no-go for the city.

---

## Part 7 — What is explicitly out of scope

- Applying any migration. The owner applies them.
- Deploying anything. Lovable deploys from `main`.
- Touching production credentials.
- Payment providers and subscription billing (roadmap Releases 2–3).
- Transaction assistance and TNRERA-gated features (roadmap Release 4).
- Any change to the public-visibility rule, which is the security control that
  keeps drafts and buyer data private.
