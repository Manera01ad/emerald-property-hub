# SQL check harness

Runs every migration in this repository against a real PostgreSQL 16 server, then
tests what the SQL actually does.

`docs/archive/RELEASE_AUDIT.md` recorded that no SQL here had ever been executed. This
directory closes that gap. It applies all 24 migration files in order and runs
five suites against the result.

## Run it

```bash
scripts/sql-check/run-all.sh
```

Needs Docker and `sudo docker` access. The first run pulls `postgres:16`. The
script creates a container named `pw-sqlcheck-pg`, a database named
`propwise_sqlcheck`, and drops and recreates that database on every run.

Remove the container when finished:

```bash
sudo docker rm -f pw-sqlcheck-pg
```

## Safety

This harness only ever talks to its own throwaway container. Three things make
that true rather than a promise:

* The database name must be one of `propwise_sqlcheck`, `sqlcheck`, `scratch`, or
  `test_scratch`. Anything else and `apply.sh` exits before connecting.
* `SUPABASE_DB_URL` and `LOVABLE_DB_MIGRATION_URL` are ignored. The connection is
  built only from the container the script starts.
* A connection string is never accepted as an argument.

There is no code path that writes to a hosted database.

## Files

| File | What it does |
| --- | --- |
| `00-supabase-stubs.sql` | Stand-ins for the Supabase pieces the migrations reference. Not a migration. |
| `apply.sh` | Applies every migration in order and reports any failure. |
| `test-concurrency.sh` | The daily cap under simultaneous load. |
| `test-isolation.sh` | Cross-user reads, function internals, spend totals. |
| `test-rls.sh` | Row-level security for the community and research tables. |
| `test-functions.sh` | The `SECURITY DEFINER` functions and the budget lifecycle. |
| `test-adversarial.sh` | What a signed-in caller can do by calling the functions directly. |
| `test-undo.sh` | Proves the undo restores the schema, by diffing against a baseline. |
| `undo-pending.sql` | Reverses the five pending migrations. Destructive; not run automatically. |
| `verify-applied.sql` | The per-migration checks in `docs/APPLY_RUNBOOK.md`, in one file. |
| `run-all.sh` | Runs all of the above. |

## The stubs

`00-supabase-stubs.sql` is not a Supabase emulator. It reproduces only the shapes
the migrations reference, so they can run on a plain server:

* `auth.uid()` reads the `app.current_user_id` session setting rather than
  decoding a JWT, so a test can become a given user and then observe what
  row-level security does.
* `anon`, `authenticated` and `service_role` are real roles, so `GRANT` and
  `REVOKE` behave as they do on the platform.
* `auth.users`, `storage.objects`, and the `extensions` schema are minimal
  versions with only the columns the migrations name.
* `pg_cron` and `pg_net` are created from stub control files. Nothing calls into
  them.

**By default the runner connects as a superuser, which bypasses row-level
security.** A test that checks RLS must `SET ROLE anon` or `SET ROLE
authenticated` first, or it proves nothing. The RLS and isolation suites do this.
If you add a test, do the same.

## Reading the output

`PASS` and `FAIL` are assertions. `SKIP` means a fixture could not be created.
`KNOWN FINDING` is a recorded property of the SQL rather than a test failure, and
is listed in `docs/SQL_TEST_FINDINGS.md`.

A non-zero exit means a migration failed to apply, or an assertion failed.

## The undo check

`test-undo.sh` builds the schema twice — once from the 19 applied migrations,
once from all 24 followed by `undo-pending.sql` — and diffs them. They must be
identical. It compares tables, columns, constraints, policies, row-level security
flags, and the body of every function, because an undo that leaves the right
function name attached to the wrong body is not an undo.

It also refuses to compare if the schema query errors, and refuses to pass if the
pending migrations turned out to change nothing — either would make the diff pass
for the wrong reason.

## Known findings

Two, both in `drizzle/pending/0021_ai_cost_control.sql`. See
`docs/SQL_TEST_FINDINGS.md` for the evidence and suggested fixes.
