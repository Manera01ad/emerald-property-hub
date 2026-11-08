# Apply runbook

How to apply the migrations that are sitting in `drizzle/pending/`, safely, with a
way to confirm each one worked.

Written for the repository owner. Every query below was run against a real
PostgreSQL 16 server with all 24 migrations applied, so the expected results are
observed rather than guessed.

## Read this first

Three things before touching anything.

**1. These five files are not applied by `drizzle-kit`.** They are not registered
in `drizzle/migrations/meta/_journal.json`. That journal has 19 entries and ends
at `0018_owner_submissions`. The five files in `drizzle/pending/` are applied by
hand, in the order below, or not at all. Running `drizzle-kit` will not pick them
up.

**2. The assistant is down until `0021` is applied.** This is the sequencing trap.
The cost-control code merged in #24 is fail-closed: `reserveBudget` calls the
`reserve_ai_budget` function, and if that function does not exist the call returns
`enforcement_unavailable`, which `chat.server.ts` turns into HTTP 503 for every
user. So:

> Apply `0021` **before** the assistant is used by real visitors. Until it is
> applied, every chat request fails with a 503. That is the intended fail-closed
> behaviour, not a bug — but it means the assistant is not usable in the meantime.

**3. I could not read your production database, and did not try.** Everything in
this runbook was verified on a throwaway local container. Your project's actual
current state is unknown to me. Step 1 is how you find it out.

## Step 0 — Take a snapshot

Do this first, and do not skip it. Every step after this one changes the database,
and a snapshot is the only reliable way back.

* If your Supabase plan includes point-in-time recovery, note the current time
  and confirm PITR is on before you start.
* If it does not, take a logical dump:

```bash
pg_dump --no-owner --no-privileges "$SUPABASE_DB_URL" > propwise-before-$(date +%F).sql
```

Keep that file somewhere safe. It is the undo.

## Step 1 — Establish the starting point

Run this against your project to see what is actually there:

```sql
SELECT relname FROM pg_class
 WHERE relnamespace = 'public'::regnamespace
   AND relname IN (
     'community_threads','community_posts','community_reports','community_moderation_log',
     'research_contributors','research_tasks','research_submissions','research_rewards',
     'research_moderation_log','ai_usage_log','ai_budget_ledger'
   )
 ORDER BY relname;
```

**Expected before you start:** few or none of these tables. If they are all
present, the work is already done — check step 4 before assuming anything else.

Also confirm the feature flags exist:

```sql
SELECT key, value FROM public.app_settings
 WHERE key LIKE 'feature_%' ORDER BY key;
```

**Expected:**

```
feature_community=off
feature_interest_requests=off
feature_owner_submissions=off
```

All three are `off` in the migration, which is deliberate. They are switched on
in step 4, after the tables they guard exist.

## Step 2 — Apply the migrations, in this order

Order matters. `0019` widens a check constraint that `0018` creates, and `0020`
and `0021` reference objects the earlier files create.

```
1. drizzle/pending/0017_interest_requests.sql
2. drizzle/pending/0018_community.sql
3. drizzle/pending/0019_buy_rent_lease.sql
4. drizzle/pending/0020_local_research_network.sql
5. drizzle/pending/0021_ai_cost_control.sql
```

Note the numbering collision: `drizzle/migrations/` also contains a `0017`
(`0017_assistant_locality_search.sql`) and a `0018`
(`0018_owner_submissions.sql`). A pending file named `0017_interest_requests.sql`
sitting next to an applied `0017_assistant_locality_search.sql` invites the
assumption that it has already run. It has not. The full path is what identifies
the file.

Apply them one at a time and verify after each. Applying all five and then
checking leaves you guessing which one failed.

In the Supabase SQL editor, paste one file and run it. By hand:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f drizzle/pending/0017_interest_requests.sql
```

`ON_ERROR_STOP=1` matters. Without it, `psql` reports the error, carries on, and
leaves the database half-migrated.

## Step 3 — Verify each one

`scripts/sql-check/verify-applied.sql` collects all of these into one file you can
run in a single pass. The individual checks, and what each should return:

### After 0017 — interest requests

```sql
SELECT count(*) FROM pg_constraint
 WHERE conname IN ('enquiries_interest_needs_property','enquiries_interest_needs_consent_version');
```

**Expected:** `2`. This confirms the two guards are in place: an interest request
must name a property and must record which consent wording was accepted.

### After 0018 — community

```sql
SELECT count(*) FROM pg_class
 WHERE relname IN ('community_threads','community_posts','community_reports','community_moderation_log')
   AND relnamespace = 'public'::regnamespace AND relrowsecurity;
```

**Expected:** `4`. This checks both that the tables exist **and** that row-level
security is enabled on each. A table with policies but RLS switched off is wide
open, and nothing in a `CREATE POLICY` statement reveals that — which is why this
query checks `relrowsecurity` rather than counting policies.

### After 0019 — buy, rent and lease

```sql
SELECT count(*) FROM information_schema.columns
 WHERE table_name='properties' AND column_name='transaction_type';
```

**Expected:** `1`.

### After 0020 — local research network

```sql
SELECT count(*) FROM pg_class
 WHERE relname IN ('research_contributors','research_tasks','research_submissions','research_rewards','research_moderation_log')
   AND relnamespace = 'public'::regnamespace AND relrowsecurity;
```

**Expected:** `5`.

### After 0021 — AI cost control

```sql
SELECT count(*) FROM pg_proc WHERE proname IN ('reserve_ai_budget','reconcile_ai_budget');
```

**Expected:** `2`.

```sql
SELECT daily_budget_inr FROM private.ai_budget_config WHERE id = 1;
```

**Expected:** `500.0000`. That is the default daily cap in rupees. Change it here
to change it, with no deploy:

```sql
UPDATE private.ai_budget_config SET daily_budget_inr = 500, updated_at = now() WHERE id = 1;
```

**Setting it to 0 stops all AI spending.** `reserveBudget` treats a cap of zero as
a deliberate stop rather than a misconfiguration to work around. If the assistant
starts returning 429 for everyone, check this value first.

Then the three checks that matter for keeping the business's spending private:

```sql
-- no client role can read the cap table
SELECT count(*) FROM information_schema.role_table_grants
 WHERE table_name = 'ai_budget_config' AND grantee IN ('anon','authenticated');
```

**Expected:** `0`.

```sql
-- no client role can write the budget tables
SELECT count(*) FROM information_schema.role_table_grants
 WHERE table_name IN ('ai_usage_log','ai_budget_ledger')
   AND privilege_type <> 'SELECT' AND grantee IN ('anon','authenticated');
```

**Expected:** `0`. Reads by an admin are allowed; writes are not, and go through
the two functions instead.

```sql
-- anonymous cannot drive the budget functions
SELECT count(*) FROM information_schema.role_routine_grants
 WHERE routine_name IN ('reserve_ai_budget','reconcile_ai_budget') AND grantee = 'anon';
```

**Expected:** `0`.

### One end-to-end check

Sign in to the app and ask the assistant one question. A normal answer means
`0021` is working. A 503 means it is not — check that the two functions exist.
A 429 means the cap is reached or set to zero.

## Step 4 — Switch the feature flags on, one at a time

The flags are `off`. The tables they guard now exist, but nothing is visible to
users until a flag is `on`.

```sql
UPDATE public.app_settings SET value = 'on' WHERE key = 'feature_community';
```

Do one, use it, and watch it before doing the next. The order that matches how the
features depend on each other:

1. `feature_community` — needs `0018`, and `0019` for the renting/leasing
   categories.
2. `feature_owner_submissions` — needs `0018_owner_submissions.sql`, which is
   already applied.
3. `feature_interest_requests` — needs `0017` and an approved listing.

Turning a flag off again is the same statement with `'off'`. It hides the feature
without touching data, which makes it the cheapest way to back out of a problem.

## Step 5 — Confirm the assistant's cap is sane

Before real traffic arrives:

```sql
SELECT daily_budget_inr FROM private.ai_budget_config WHERE id = 1;
```

`500` is a starting point, not a recommendation. Two things to know about it:

* The cap bounds **concurrent** spend, not completed spend. A signed-in caller can
  make more calls than the cap suggests by reconciling each reservation to a small
  amount. See finding F1 in `docs/SQL_TEST_FINDINGS.md`. It is not an anonymous or
  cross-user hole, but the per-account allowance is weaker than it reads.
* Reported cost can double-count if a reservation is reconciled twice. The cap
  itself still holds, because the ledger is not affected. See finding F2.

Neither is a reason to delay applying `0021`. Both are reasons to watch the
`ai_usage_log` table for the first few days and compare it with what you expect.

## Undo

**These statements drop tables and their data.** A feature flag turned off is
almost always what you actually want; reach for the drops only if a migration
must come out.

The safest undo is the step 0 snapshot. Restoring it puts the database back
exactly as it was, with no guessing about what a partial reverse migration left
behind.

If you do need to reverse the migrations, the SQL is in
`scripts/sql-check/undo-pending.sql`. It is not inlined here on purpose — see
below.

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f scripts/sql-check/undo-pending.sql
```

### Why that file is tested rather than written here

My first attempt at this undo was wrong, in ways that would have looked fine on
inspection. `scripts/sql-check/test-undo.sh` catches them by building the schema
twice — once from the 19 applied migrations, once from all 24 followed by the
undo — and diffing the two. They must be identical.

What the diff caught:

* **Dropping the tables does not drop the functions.** `DROP TABLE
  community_threads` removes the table and its triggers, but not the functions the
  triggers call. Fifteen functions needed an explicit `DROP FUNCTION`: eight
  community, five research, two budget. Two of the community ones
  (`community_initial_status`, `community_text_is_clean`) are helpers called by
  the trigger functions rather than by triggers themselves, so they are not
  attached to any table at all and no table drop would ever have removed them.
  That is the kind of gap a diff of table names cannot show.
* **`0019` touches far more than it appears.** It adds lease terms to three
  tables, not one — `properties`, `listing_submissions` and `buyer_profiles` —
  and widens the `buyer_profiles.intent` check. Dropping only
  `properties.transaction_type` left thirty columns behind.
* **`approve_listing_submission` needs its body restored, not just its columns.**
  The `0019` version reads `s.transaction_type`. PostgreSQL resolves plpgsql
  column references when the function *runs*, not when it is created, so dropping
  the columns leaves the function in place and throwing on the next call. The
  undo restores the `0018` body.
* **`public.touch_updated_at` must not be dropped.** It predates this work and
  other tables depend on it.

Run the check yourself:

```bash
scripts/sql-check/test-undo.sh
```

### What the undo does not restore

* **Data.** Every table it drops is dropped with its rows. This reverses schema
  only.
* **The feature flags.** They are set in `app_settings`, which is not touched.
  If you turned one on, turn it off:

```sql
UPDATE public.app_settings SET value = 'off' WHERE key LIKE 'feature_%';
```

* **The `enquiries` insert policy becomes less strict than `0017` made it.** The
  undo restores the `0002` wording, which lacks `AND enquiry_type <> 'interest'`.
  Together with the two guards it drops, that reopens a path where an anonymous
  visitor can insert an `interest` row with no property and no consent version.
  This is stated in a comment in the undo file itself.

## Testing the migrations yourself

Before applying anything, you can run the whole set against a throwaway database
and watch it succeed:

```bash
scripts/sql-check/run-all.sh
```

This needs Docker and never connects to your project. See
`scripts/sql-check/README.md`. It is also how the expected results in this
document were produced.

## Optional: keep CI honest about the assistant

Not required, and not done here, because it would touch `.github/`.

The repository has no browser test, so the assistant's own page is never loaded
by CI. A minimal guard would add a Playwright step to `verify.yml` that opens the
home page, types a question, and asserts a response element appears — with no real
AI call and no credits spent, by intercepting the network route. That would catch
a build that renders a blank page, which the current unit tests cannot.

## What this runbook does not cover

* **Payments.** No payment gateway exists in the codebase. Nothing here enables
  billing, and nothing should until a provider is chosen and approved.
* **Legal questions.** Applying SQL does not settle anything about Tamil Nadu
  real estate regulation, privacy, tax, or how contributor rewards are treated.
  Those remain open, and are flagged in `docs/archive/RELEASE_AUDIT.md`.
* **The Google Maps key.** Still in git history across four commits. Applying
  migrations does not help; the key needs rotating at the provider.
* **Rollback of a half-applied file.** If a file fails part way through, some of
  its statements have run. Restore the step 0 snapshot rather than trying to
  work out which.
