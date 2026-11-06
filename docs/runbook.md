# Operations runbook

Date: 2026-10-29
Status: procedure for the owner. Agents do not execute any of this.

This is the missing document identified in `docs/audit-2026-10-29.md` §5.3. It
covers backups, rollback, and the checks that tell you the site is healthy.

Everything below is written to be run by the repository owner. No agent should
apply a migration, restore a database, or rotate a credential.

---

## 1. What can break, and what you would see

| Failure | What a visitor sees | What tells you first |
| --- | --- | --- |
| Bad deploy of `main` | Error page or blank page | Uptime check on `/` (see §4) |
| Supabase project paused or over quota | Listings stop loading | Uptime check + error page |
| Scheduler stopped | Nothing — the site still works | Heartbeat check (§4) |
| A source feed dies | Nothing — research just stalls | Admin → Research shows `failed` |
| Storage or photo signing broken | Photos show a placeholder | Manual check on a listing |

The important asymmetry: a broken deploy is loud, a stopped scheduler is silent.
That is why §4 exists.

---

## 2. Backups

### What is backed up, and by whom

The database, auth users and the `property-photos` storage bucket currently live
in the Lovable-managed Supabase project `dashpanandamjickoytj`. **The migration
target is a new, owner-controlled project, `lgetjiksdzoqfryelvmv`.** Backups are
a property of whichever project is in use, not of this repository.

Until the cutover is complete, `dashpanandamjickoytj` is still the live database.
After it, it is history. `docs/LOVABLE_EXIT.md` §3.1.2 gives the order; the
important part is that the data does not move by itself.

**Action for the owner, once:** open the Supabase dashboard for the project and
record, in the table below, the plan's backup retention and whether
point-in-time recovery is on. Do not guess these values.

| Item | Value | Recorded on |
| --- | --- | --- |
| Plan | _to be filled in_ | |
| Daily backup retention | _to be filled in_ | |
| Point-in-time recovery | _to be filled in_ | |
| Storage bucket backup | _to be filled in_ | |

### The rule that matters

A backup you have never restored is not a backup. Until you have restored one into
a scratch project and read a row back, treat the retention numbers as unverified.

---

## 3. Restore

### 3.1 Restore the whole database

1. In the Supabase dashboard, choose the restore point.
2. Restore into a **new** project first, never over production. You want to read
   the data before you commit to it.
3. Point a local `.env` at the new project's URL and publishable key.
4. Run `bun run dev` and load `/properties`. If listings render, the restore
   carried the data.
5. Only then decide whether to promote it.

### 3.2 Restore one table

If a single table is wrong (for example `properties` was bulk-edited by mistake):

1. Restore the snapshot into a scratch project as above.
2. Copy the good rows out with `pg_dump --table=public.properties`.
3. Load them into production with a transaction, so a failure rolls back whole.

Do not delete from production first. Insert the good rows, verify, then remove the
bad ones.

### 3.3 Storage

`property-photos` holds the listing images. A database restore does **not** bring
back deleted images. Check the bucket separately, and remember that photo
visibility is governed by migration `0007` — after any restore, confirm that policy
still exists.

---

## 4. Health checks to put in place

These are the smallest changes that turn a silent failure into an alert.

### 4.1 Uptime on the public site

A check on `https://emerald-property-hub.lovable.app/` every 5 minutes, alerting
when:

- the status is not 200, or
- the response body contains `This page didn't load`.

The second condition is what catches the blank-screen class of failure, which
otherwise returns 200.

### 4.2 Research heartbeat

The pipeline writes a row to `research_ticks` on every run. Alert when no tick
appears for more than 2 hours. The pure rule for this is
`pipelineHealth` in `src/lib/research/health.ts`; the alert needs something
outside the database, because a database that is down cannot report its own
silence.

### 4.3 A weekly manual pass

Once a week, as an admin:

1. Admin → Research: is every agent's last status `ok`? Any `failed` with a high
   `consecutive_failures`?
2. Admin → Research: does the tick list show `automatic` runs, not only `manual
   call`? Only-manual ticks mean the scheduler is dead.
3. Admin → Listings: any verification expired (shown in red)?
4. `Security` workflow: is the latest nightly run green?

---

## 5. Rollback

### 5.1 Rolling back a bad code deploy

Lovable deploys from `main`, and there is no separate deploy step. So rolling back
a bad change means putting `main` back to the last good commit.

1. Find the last good commit: `git log --oneline main`.
2. Revert the bad commit on a branch:
   `git revert <sha>` (a new commit, which does not rewrite history).
3. Open a pull request, get the checks green, and merge.

**Never force-push, rebase, or amend commits that are already pushed.** It rewrites
history on Lovable's side and the project history is lost. `git revert` is the only
safe rollback here.

### 5.2 Rolling back a database change

Migrations are additive by design (see `docs/architecture-pan-india.md`), so the
rollback for most of them is to stop using the new column and leave it in place.
That is deliberate: dropping a column is destructive, and an unused column costs
nothing.

If a column must actually be dropped, do it in a scratch project first, verify the
app still runs, then apply it in production during a quiet window.

### 5.3 Rolling back a city

If a newly activated city causes a problem, set `is_active = false` on its row in
`public.cities`. That is the kill switch, and it needs no deploy.

---

## 6. Credentials

| Credential | Where it lives | Rotation |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project settings, server only | Supabase dashboard |
| `LOVABLE_DB_MIGRATION_URL` | Owner's machine only | Supabase dashboard |
| `LOVABLE_CRON_SECRET` | Server environment | Rotate, then update the database job |
| `private.scheduler_token` | Database `private` schema | `UPDATE private.scheduler_token SET token = encode(extensions.gen_random_bytes(32),'hex')`, then update the cron job |
| Google Maps browser key | Google Cloud Console | **Outstanding: rotate and restrict to the PropWise domains** |

The Maps key was committed in `.env` in October 2026 and is still readable in git
history. Rotating it is the one security action from the audit that has not been
done. After rotation, delete the two `commits` entries from `.gitleaks.toml`, or
delete the file if nothing else remains.

---

## 7. The scheduler, once confirmed

The `cron.schedule(...)` call that drives the hourly research run is not in this
repository — it exists only in the database (audit §5.1). The owner should:

1. Read the existing job:
   ```sql
   SELECT jobid, schedule, command, active FROM cron.job;
   ```
2. Confirm it targets `https://emerald-property-hub.lovable.app/api/public/research/tick`
   with the right bearer token and the `X-PropWise-Origin: pg_cron` header.
3. Record the statement in a migration file so it is version-controlled and can be
   restored.
4. Confirm the route answers `GET` with 405 after the fix in this audit, so a
   `GET`-based job cannot look healthy while doing nothing.
