#!/usr/bin/env bash
# Apply every migration to a scratch database, then run every check.
#
# This is the single command that closes the gap the release audit identified:
# that no SQL in this repository had ever been executed. It runs against a
# throwaway PostgreSQL container, never a hosted project.
#
# Usage: scripts/sql-check/run-all.sh
#
# Exit code 0 means every migration applied and every check passed. A non-zero
# exit names which stage failed. Known findings that are recorded rather than
# fixed do not fail the run; they print a KNOWN FINDING line.

set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"

echo "=============================================================="
echo " 1/6  apply every migration"
echo "=============================================================="
bash "$HERE/apply.sh" --drop || { echo; echo "STOPPED: migrations did not apply."; exit 1; }

echo
echo "=============================================================="
echo " 2/6  seed test users"
echo "=============================================================="
sudo docker exec -i -e PGPASSWORD=pw pw-sqlcheck-pg \
  psql -U postgres -d propwise_sqlcheck -q -v ON_ERROR_STOP=1 -c "
    INSERT INTO auth.users (id, email) VALUES
      ('11111111-1111-1111-1111-111111111111','admin@test.local'),
      ('22222222-2222-2222-2222-222222222222','user-a@test.local'),
      ('33333333-3333-3333-3333-333333333333','user-b@test.local')
    ON CONFLICT (id) DO NOTHING;
  " >/dev/null 2>&1
# The first-admin trigger assigns 'admin' to the first account inserted, which is
# the same rule production uses.
echo "  OK    users seeded; admin role assigned by the 0000 trigger"
admin=$(sudo docker exec -i -e PGPASSWORD=pw pw-sqlcheck-pg psql -U postgres -d propwise_sqlcheck -t -A -c \
  "SELECT count(*) FROM public.user_roles WHERE role='admin';" | tr -d ' ')
if [ "$admin" != "1" ]; then
  echo "  FAIL  expected exactly 1 admin, found $admin"; exit 1
fi
echo "  OK    exactly one admin exists"

STATUS=0
for t in test-concurrency test-isolation test-rls test-functions test-adversarial; do
  echo
  echo "=============================================================="
  echo " running $t"
  echo "=============================================================="
  bash "$HERE/$t.sh" || STATUS=1
done

echo
echo "=============================================================="
echo " summary"
echo "=============================================================="
if [ "$STATUS" = "0" ]; then
  echo " every suite passed."
else
  echo " at least one suite failed. See the output above."
fi
echo
echo " the scratch container is still running for inspection:"
echo "   sudo docker exec -it pw-sqlcheck-pg psql -U postgres -d propwise_sqlcheck"
echo " remove it with:"
echo "   sudo docker rm -f pw-sqlcheck-pg"
exit "$STATUS"
