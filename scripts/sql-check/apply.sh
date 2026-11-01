#!/usr/bin/env bash
# Apply every migration to a scratch PostgreSQL database and report what happens.
#
# Usage:
#   scripts/sql-check/apply.sh                 # start a container, apply everything
#   scripts/sql-check/apply.sh --port 5433     # reuse an existing server
#   scripts/sql-check/apply.sh --drop          # drop and recreate the database first
#
# SAFETY. This script refuses to run against anything that looks like a real
# Supabase project:
#   * the database name must be one of the throwaway names below;
#   * SUPABASE_* and LOVABLE_* environment variables are ignored entirely -- the
#     connection is built only from the flags here;
#   * a connection string is never accepted as an argument.
# It creates and drops its own database. There is no code path that writes to a
# hosted database.

set -uo pipefail

DB_NAME="propwise_sqlcheck"
CONTAINER="pw-sqlcheck-pg"
DROP_FIRST=0
DB_USER="postgres"
DB_PASS="pw"

while [ $# -gt 0 ]; do
  case "$1" in
    --drop) DROP_FIRST=1; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

# Refuse to run against a database whose name suggests it is real. This is the
# guard that makes "never connect to a real project" enforceable rather than a
# promise in a comment.
case "$DB_NAME" in
  propwise_sqlcheck|sqlcheck|scratch|test_scratch) : ;;
  *) echo "refusing: unexpected database name '$DB_NAME'" >&2; exit 2 ;;
esac
if [ -n "${SUPABASE_DB_URL:-}" ] || [ -n "${LOVABLE_DB_MIGRATION_URL:-}" ]; then
  echo "note: SUPABASE_DB_URL / LOVABLE_DB_MIGRATION_URL are set but ignored." >&2
  echo "      this harness only ever talks to the local scratch server." >&2
fi

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
PSQL="sudo docker exec -i -e PGPASSWORD=$DB_PASS $CONTAINER psql -U $DB_USER -v ON_ERROR_STOP=1 -q"

# ---------------------------------------------------------------- container
# Reuse a container only if it is actually running. A container left in the
# "Created" state by an interrupted start would otherwise be mistaken for a
# healthy server, and every later command would fail against a dead database.
state=$(sudo docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null)
if [ "$state" != "true" ]; then
  if sudo docker inspect "$CONTAINER" >/dev/null 2>&1; then
    echo "removing a stopped scratch container..."
    sudo docker rm -f "$CONTAINER" >/dev/null 2>&1
  fi
  echo "starting a scratch PostgreSQL container ($CONTAINER)..."
  sudo docker run -d --name "$CONTAINER" \
    -e POSTGRES_PASSWORD="$DB_PASS" -e POSTGRES_DB=postgres \
    postgres:16 >/dev/null || { echo "could not start the container" >&2; exit 1; }
fi
for _ in $(seq 1 60); do
  sudo docker exec "$CONTAINER" pg_isready -q 2>/dev/null && break
  sleep 1
done
if ! sudo docker exec "$CONTAINER" pg_isready -q 2>/dev/null; then
  echo "PostgreSQL did not become ready" >&2
  sudo docker logs "$CONTAINER" 2>&1 | tail -20 >&2
  exit 1
fi

# Install the extension stubs (idempotent; the image is disposable).
PGDIR="/usr/share/postgresql/16/extension"
sudo docker exec "$CONTAINER" bash -c "
  for ext in pg_cron pg_net; do
    printf \"comment = 'stub for local testing'\ndefault_version = '1.0'\nrelocatable = false\n\" > $PGDIR/\$ext.control
    echo '-- stub' > $PGDIR/\$ext--1.0.sql
  done" 2>/dev/null

# ---------------------------------------------------------------- database
if [ "$DROP_FIRST" = "1" ]; then
  $PSQL -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" >/dev/null
fi
$PSQL -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" >/dev/null 2>&1
$PSQL -d postgres -c "CREATE DATABASE $DB_NAME;" >/dev/null

# ---------------------------------------------------------------- apply
run_file() {
  local label="$1" path="$2"
  local out
  if out=$($PSQL -d "$DB_NAME" -f - < "$path" 2>&1); then
    echo "  OK    $label"
    return 0
  else
    echo "  FAIL  $label"
    echo "$out" | sed 's/^/          /' | grep -vE "^\s*$" | head -12
    return 1
  fi
}

echo
echo "applying 00-supabase-stubs.sql (not a migration; the stand-ins)"
if ! $PSQL -d "$DB_NAME" -f - < "$HERE/00-supabase-stubs.sql" >/dev/null 2>&1; then
  echo "  FAIL  stubs -- cannot continue"
  $PSQL -d "$DB_NAME" -f - < "$HERE/00-supabase-stubs.sql" 2>&1 | head -20
  exit 1
fi
echo "  OK    stubs"

FAILED=0
echo
echo "applying drizzle/migrations in name order:"
for f in $(ls "$REPO"/drizzle/migrations/*.sql | sort); do
  run_file "$(basename "$f")" "$f" || FAILED=$((FAILED+1))
done

echo
echo "applying drizzle/pending in name order:"
for f in $(ls "$REPO"/drizzle/pending/*.sql | sort); do
  run_file "$(basename "$f")" "$f" || FAILED=$((FAILED+1))
done

echo
if [ "$FAILED" = "0" ]; then
  echo "result: every file applied, in this order, with no errors."
else
  echo "result: $FAILED file(s) failed. See above."
fi
exit "$FAILED"
