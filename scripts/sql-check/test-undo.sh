#!/usr/bin/env bash
# Does the undo in undo-pending.sql actually put the database back?
#
# The runbook tells the owner how to reverse the pending migrations if something
# goes wrong. An undo that is almost right is worse than none, because it looks
# like a way back. So rather than reading the SQL, this script proves it:
#
#   1. Build database `pre`  from the 19 applied migrations only.
#   2. Build database `after` from those 19, then the 5 pending ones, then run the
#      undo.
#   3. Dump the schema of both, excluding the platform stubs, and diff them.
#
# If the undo is complete and correct, the two schemas are identical. Any leftover
# object shows up as a line in the diff.
#
# Usage: scripts/sql-check/test-undo.sh

set -uo pipefail

DB="propwise_sqlcheck"
CONTAINER="pw-sqlcheck-pg"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"

run() { sudo docker exec -i -e PGPASSWORD=pw "$CONTAINER" psql -U postgres -d "$1" -v ON_ERROR_STOP=1 -q -f - ; }
newdb() {
  sudo docker exec -i -e PGPASSWORD=pw "$CONTAINER" psql -U postgres -q -c "DROP DATABASE IF EXISTS $1;" >/dev/null 2>&1
  sudo docker exec -i -e PGPASSWORD=pw "$CONTAINER" psql -U postgres -q -c "CREATE DATABASE $1;" >/dev/null 2>&1
}

# A normalised description of everything the migrations created. Ordered, and with
# the stubs excluded, so the two dumps can be compared line for line. Volatile
# values (an object's oid, a policy's text) are reduced to what matters: the name
# and the table it belongs to.
schema_dump() {
  sudo docker exec -i -e PGPASSWORD=pw "$CONTAINER" psql -U postgres -d "$1" -t -A -F'|' -c "
    SELECT 'table|' || c.relname
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname IN ('public','private') AND c.relkind = 'r'
       AND c.relname NOT IN ('app_settings') OR (c.relname = 'app_settings' AND n.nspname = 'public')
    UNION ALL
    SELECT 'column|' || c.relname || '.' || a.attname || '|' || format_type(a.atttypid, a.atttypmod)
      FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname IN ('public','private') AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
    UNION ALL
    SELECT 'constraint|' || c.relname || '|' || con.conname || '|' || pg_get_constraintdef(con.oid)
      FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname IN ('public','private')
    UNION ALL
    SELECT 'policy|' || c.relname || '|' || p.polname || '|' || p.polcmd::text || '|' || coalesce(pg_get_expr(p.polqual, p.polrelid),'') || '|' || coalesce(pg_get_expr(p.polwithcheck, p.polrelid),'')
      FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname IN ('public','private')
    UNION ALL
    SELECT 'function|' || p.proname || '|' || md5(p.prosrc)
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
    UNION ALL
    SELECT 'rls|' || c.relname || '|' || c.relrowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname IN ('public','private') AND c.relkind = 'r'
     ORDER BY 1;
  " 2>&1 | grep -vE '^(SET|RESET)$'
}

# If the query above fails, both dumps return the same error text and the diff
# would pass. Refuse to compare an error.
dump_or_die() {
  local out
  out=$(schema_dump "$1")
  if echo "$out" | grep -q '^ERROR'; then
    echo "  FAIL the schema query errored:" >&2
    echo "$out" | head -3 >&2
    exit 1
  fi
  printf '%s\n' "$out"
}

echo "does the undo in undo-pending.sql restore the schema?"
echo

echo "building 'pre'  -- 19 applied migrations only"
newdb pre
run pre < "$HERE/00-supabase-stubs.sql" >/dev/null 2>&1 || { echo "  FAIL stubs"; exit 1; }
for f in $(ls "$REPO"/drizzle/migrations/*.sql | sort); do
  run pre < "$f" >/dev/null 2>&1 || { echo "  FAIL $(basename "$f")"; exit 1; }
done
echo "  OK"

echo "building 'after' -- 19 applied, 5 pending, then the undo"
newdb after
run after < "$HERE/00-supabase-stubs.sql" >/dev/null 2>&1 || { echo "  FAIL stubs"; exit 1; }
for f in $(ls "$REPO"/drizzle/migrations/*.sql | sort); do
  run after < "$f" >/dev/null 2>&1 || { echo "  FAIL $(basename "$f")"; exit 1; }
done
for f in $(ls "$REPO"/drizzle/pending/*.sql | sort); do
  run after < "$f" >/dev/null 2>&1 || { echo "  FAIL $(basename "$f")"; exit 1; }
done
echo "  OK (all 24 applied)"

# Before undoing, confirm the two databases really do differ. Otherwise the diff
# below could pass because the pending migrations never changed anything, which
# would make the whole test meaningless.
before_diff=$(diff <(dump_or_die pre) <(dump_or_die after) | grep -c '^[<>]')
if [ "$before_diff" -eq 0 ]; then
  echo "  FAIL the pending migrations changed nothing; this test cannot prove anything"
  exit 1
fi
echo "  OK (the pending migrations differ from the baseline by $before_diff lines)"

echo "running the undo"
run after < "$HERE/undo-pending.sql" >/dev/null 2>&1 || { echo "  FAIL the undo raised an error"; exit 1; }
echo "  OK"

echo "comparing schemas"
if diff <(dump_or_die pre) <(dump_or_die after) > /tmp/undo-diff.txt; then
  echo "  OK  the undo restores the schema exactly"
  echo
  echo "RESULT: PASS"
  sudo docker exec -i -e PGPASSWORD=pw "$CONTAINER" psql -U postgres -q -c "DROP DATABASE IF EXISTS pre;" >/dev/null 2>&1
  sudo docker exec -i -e PGPASSWORD=pw "$CONTAINER" psql -U postgres -q -c "DROP DATABASE IF EXISTS after;" >/dev/null 2>&1
  exit 0
else
  echo "  FAIL the undo left the schema different from the baseline:"
  echo
  head -40 /tmp/undo-diff.txt | sed 's/^/    /'
  echo
  echo "RESULT: FAIL"
  exit 1
fi
