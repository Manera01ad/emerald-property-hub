# SQL test findings

What this document is: the results of running every migration in this repository
against a real PostgreSQL 16 server, for the first time.

Why it exists: `docs/archive/RELEASE_AUDIT.md` recorded that no SQL in this repository had
ever been executed — not the 19 applied migrations, not the 5 in
`drizzle/pending/`. Everything below was found by running the files, not by
reading them.

How to reproduce:

```bash
scripts/sql-check/run-all.sh
```

That command starts a throwaway PostgreSQL container, applies all 24 files in
order, and runs the five test suites. It never connects to a hosted project; the
script refuses to run against anything but its own scratch database.

## What ran

| Stage | Files | Result |
| --- | --- | --- |
| Applied migrations, `drizzle/migrations/*.sql` | 19 | all applied |
| Pending migrations, `drizzle/pending/*.sql` | 5 | all applied |
| Concurrency suite | 0021 | pass |
| Isolation suite | 0021 | pass |
| Row-level security suite | 0017–0020 | pass |
| Function and lifecycle suite | 0019, 0020, 0021 | pass |
| Adversarial suite | 0021 | 2 findings recorded |

The migration files apply cleanly, in numeric order, with no errors. That is a
real result: it had not been demonstrated before, and it is the precondition for
applying any of them.

## Findings

Two findings, both in `drizzle/pending/0021_ai_cost_control.sql`. Both are
properties of the SQL as written. Neither is a crash and neither is a
break-in — both come from calling the functions the way they are designed to be
called.

### F1. The daily cap bounds concurrent spend, not completed spend

Severity: low to moderate. It weakens the cost control rather than breaking it.

**What was observed.** With the daily cap set to ₹10 and each reservation asking
for ₹5, a single signed-in caller completed six paid calls in a row. The cap
should have allowed two.

**Why.** The cap is computed from rows that are either in flight
(`reconciled_at IS NULL`) or settled (`reconciled_at IS NOT NULL`, summing
`actual_inr`). When a caller closes a reservation with a small actual amount, the
difference is released immediately. A caller who reserves ₹5, reports an actual
of ₹0.01, and repeats is bounded only by the rate limit, not by the cap.

**Why it is not simply a bug.** The refund is deliberate, and the intent is
documented in `src/lib/assistant/budget.test.ts`:

> A reservation reconciled to less than reserved frees the difference for the
> next caller; this is what stops the cap from ratcheting down.

That reasoning is sound for the normal path: the assistant reserves an estimate,
then reports the real cost, and the difference should be reusable. The design
question is whether the released amount should be capped by a per-user daily
allowance, so that one account cannot reclaim the whole day's budget through
repeated small calls.

**What it is not.** This is not an anonymous or cross-user attack. The function
requires an authenticated caller, and a caller cannot touch another user's
reservation. The exposure is one signed-in account consuming more than the
per-account allowance the pricing model assumes.

**Suggested fix, for the owner to decide.** Track per-user settled spend for the
day and refuse when it exceeds a per-user ceiling, independently of the global
cap. That keeps the global cap as the backstop it is meant to be while making the
per-account limit real.

### F2. `reconcile_ai_budget` is not idempotent

Severity: low. It distorts reporting, not enforcement.

**What was observed.** Calling `reconcile_ai_budget` twice for the same
reservation writes two rows to `ai_usage_log`. The recorded cost for one call
went from ₹4 to ₹8.

**Why.** The function updates the ledger row and then inserts into
`ai_usage_log` with no guard on whether the reservation was already closed.

**What it does not affect.** The ledger, which is what the cap reads. The
`UPDATE` assigns `actual_inr` rather than adding to it, so a second reconcile
leaves the charged amount unchanged. Verified: after a double reconcile, the
ledger still held ₹4 and a further ₹7 reservation against a ₹10 cap was still
refused.

**What it does affect.** `ai_usage_log` is the table the admin control centre
would read for cost reporting. A duplicate `onFinish` — a retried request, a
reconnect, or a stream that finishes twice — inflates reported spend without
inflating actual spend.

**Suggested fix, for the owner to decide.** Add a guard so a reservation can only
be closed once:

```sql
UPDATE public.ai_budget_ledger
   SET actual_inr = COALESCE(_actual_inr, _row.reserved_inr),
       reconciled_at = now()
 WHERE id = _reservation_id
   AND reconciled_at IS NULL;
IF NOT FOUND THEN RETURN; END IF;
```

The `RETURN` then skips the usage-log insert. This is a change to a migration the
owner has not applied yet, so it is proposed rather than made.

## What was checked and found correct

Recorded so the checks do not have to be repeated from scratch.

**The cap holds under concurrency.** 60 simultaneous reservations against a ₹10
cap allowed exactly 10. 80 simultaneous reservations of ₹2 against a ₹7 cap
allowed exactly 3 (₹6), refusing the fourth because it would have exceeded the
cap. The `pg_advisory_xact_lock` serialisation works, and this is the one
property a single-connection test cannot demonstrate.

**The cap cannot be raised by the caller.** `reserve_ai_budget` reads the stored
value from `private.ai_budget_config` and treats it as a ceiling. A caller
passing ₹999,999 against a stored cap of ₹500 is refused.

**Abandoned reservations are released.** A reservation left open for ten minutes
stops holding budget once the next reservation sweeps it.

**No spend total is readable.** `reserve_ai_budget` returns four columns, none of
which is a sum. No function in the database returns a total. This is the property
that keeps the business's daily cost from being public.

**The budget tables are not readable by ordinary users or by anonymous callers.**
Anonymous is refused at the grant; a signed-in user gets no rows. Only an admin
can read them.

**The cap table is unreachable.** `private.ai_budget_config` is refused to
anonymous, to ordinary users, and to admins directly. Only the `SECURITY DEFINER`
functions can read it.

**A reservation can only be closed by its owner.** A second user calling
`reconcile_ai_budget` with someone else's reservation id changes nothing.

**A caller cannot author as another user, or edit or delete another user's
posts.** Row-level security and the `WITH CHECK` clauses hold.

**An author cannot publish their own thread.** `community_set_initial_status`
forces a new thread to `pending` unless the caller is an admin. This is a trigger
rather than a policy, so reading only the policies would miss it.

**Moderation logs, unreviewed submissions and contributor records stay private.**
Anonymous is refused at the grant; ordinary users see no rows.

**`approve_listing_submission` is admin-only**, rejects a too-short title, and
creates the property as `draft`, `is_demo = false`, `verification_status =
'unverified'` — the conservative defaults the listing rules call for.

**`accept_research_submission` and `reject_research_submission` are admin-only.**

## Limits of this work

What this testing does not establish.

**It is not a Supabase environment.** `scripts/sql-check/00-supabase-stubs.sql`
stands in for the platform: `auth.uid()` reads a session setting instead of
decoding a JWT, and `auth.users`, `storage.objects`, `pg_cron` and `pg_net` are
minimal stand-ins. Real behaviour under Supabase's JWT handling, its connection
pooler, and its own role setup is not covered. Row-level security is exercised
correctly because the tests switch to real `anon` and `authenticated` roles, but
the path from an HTTP request to a JWT claim is not.

**Concurrency is real but modest.** The tests open genuine simultaneous
connections through `psql`, so the locking is genuinely exercised. The volume is
60 to 80 connections, not the thousands a public launch would bring. Behaviour
under connection-pool exhaustion is not tested.

**`pg_cron` and `pg_net` are stubs.** No scheduled job is tested. Migration 0004
creates both extensions and migration 0005 references `origin IN
('pg_cron','manual_endpoint')`, so a scheduled path exists somewhere, but nothing
in this harness runs it.

**No application code is exercised.** These tests call SQL directly. The
TypeScript layer that calls these functions — `budget.server.ts`,
`chat.server.ts` — is covered by its own unit tests with a mocked client, which
is exactly the gap this work was meant to close on the database side. The two
halves have still never run against each other.

**Only the two findings above are claimed.** Everything under "found correct" is
what was tested. Absence of a finding is not proof of absence of a bug,
particularly in the parts of 0018–0020 that no test touches.

## Migration numbering

`drizzle/migrations/` and `drizzle/pending/` both contain a `0017` and a `0018`:

| Directory | 0017 | 0018 |
| --- | --- | --- |
| `drizzle/migrations/` | `0017_assistant_locality_search.sql` | `0018_owner_submissions.sql` |
| `drizzle/pending/` | `0017_interest_requests.sql` | `0018_community.sql` |

`drizzle/migrations/meta/_journal.json` has 19 entries and ends at
`0018_owner_submissions`. The five pending files are not registered in the
journal at all.

This is not a fault in the SQL — all 24 files apply cleanly in name order, and
the pending set sorts after the applied set. It matters for the person applying
them: a file named `0017_interest_requests.sql` sitting next to an already-applied
`0017_assistant_locality_search.sql` invites the assumption that it has already
run. The runbook in `docs/APPLY_RUNBOOK.md` gives the exact order. Renaming the
pending files to `0022`–`0026` and adding them to the journal would remove the
ambiguity, but that is a change to migration history and is left for the owner.

## Files added

| File | Purpose |
| --- | --- |
| `scripts/sql-check/00-supabase-stubs.sql` | Stand-ins for the Supabase pieces the migrations reference. Not a migration. |
| `scripts/sql-check/apply.sh` | Starts a scratch container and applies every migration in order. |
| `scripts/sql-check/test-concurrency.sh` | The cap under simultaneous load. |
| `scripts/sql-check/test-isolation.sh` | Cross-user reads, function internals, spend totals. |
| `scripts/sql-check/test-rls.sh` | Row-level security for 0017–0020. |
| `scripts/sql-check/test-functions.sh` | The `SECURITY DEFINER` functions and the budget lifecycle. |
| `scripts/sql-check/test-adversarial.sh` | F1 and F2. |
| `scripts/sql-check/run-all.sh` | Runs all of the above. |
