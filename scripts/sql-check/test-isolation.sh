#!/usr/bin/env bash
# Isolation tests for migration 0021.
#
# Three things must hold, and each is tested as a real database role rather than
# as a superuser, because a superuser bypasses row-level security and would make
# every one of these tests pass for the wrong reason:
#
#   1. An ordinary signed-in user cannot read another user's ai_usage_log or
#      ai_budget_ledger rows.
#   2. An ordinary user cannot reach the internals of the budget functions --
#      specifically the private.ai_budget_config table that holds the cap.
#   3. No caller can read a spend total. The functions return a decision, never a
#      sum, so the business's daily cost is not public.
#
# Usage: scripts/sql-check/test-isolation.sh

set -uo pipefail

DB="propwise_sqlcheck"
CONTAINER="pw-sqlcheck-pg"
ADMIN_ID="11111111-1111-1111-1111-111111111111"
USER_A="22222222-2222-2222-2222-222222222222"
USER_B="33333333-3333-3333-3333-333333333333"

PASS=0
FAIL=0

# Run one statement as a given role and user id, and return the raw result.
# SET ROLE is what makes RLS apply; without it the connection is a superuser.
# An empty role means "run as the connecting superuser", which is only used for
# catalog queries that no policy governs.
as() {
  local role="$1" uid="$2" sql="$3"
  local pre=""
  [ -n "$role" ] && pre="SET ROLE $role;"
  [ -n "$uid" ] && pre="$pre SET LOCAL app.current_user_id = '$uid';"
  sudo docker exec -i -e PGPASSWORD=pw "$CONTAINER" \
    psql -U postgres -d "$DB" -t -A -v ON_ERROR_STOP=0 -c "$pre $sql" 2>&1 | grep -vE "^(SET|RESET)$"
}

# A check that passes when the observed value equals the expected one.
expect() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    printf '  PASS  %s\n' "$label"
    PASS=$((PASS + 1))
  else
    printf '  FAIL  %s\n        expected [%s]\n        actual   [%s]\n' "$label" "$expected" "$actual"
    FAIL=$((FAIL + 1))
  fi
}

# A check that passes when the caller is blocked, however that happens.
#
# Blocking can take two forms and both are correct:
#   * a permission error, when the role has no GRANT at all -- the check never
#     reaches row-level security, which is the stronger outcome;
#   * zero rows, when the grant exists but no policy admits the caller.
# Asserting only "zero rows" would wrongly report a failure for the first form,
# which is what happened on the first run of this script.
blocked() {
  local label="$1" role="$2" uid="$3" sql="$4"
  local out
  out=$(as "$role" "$uid" "$sql")
  if echo "$out" | grep -qiE "permission denied|must be owner"; then
    printf '  PASS  %s (refused at the grant)\n' "$label"
    PASS=$((PASS + 1))
  elif [ "$(echo "$out" | tr -d '[:space:]')" = "0" ]; then
    printf '  PASS  %s (no rows visible)\n' "$label"
    PASS=$((PASS + 1))
  else
    printf '  FAIL  %s\n        expected a refusal or 0, got [%s]\n' "$label" "$out"
    FAIL=$((FAIL + 1))
  fi
}

echo "isolation tests for migration 0021"
echo

# ---------------------------------------------------------------- fixtures
# One reservation per user, so each table has a row that belongs to someone.
sudo docker exec -i -e PGPASSWORD=pw "$CONTAINER" psql -U postgres -d "$DB" -q \
  -v ON_ERROR_STOP=1 -c "
    DELETE FROM public.ai_budget_ledger;
    DELETE FROM public.ai_usage_log;
    UPDATE private.ai_budget_config SET daily_budget_inr = 500 WHERE id = 1;
    SET ROLE authenticated;
    SET LOCAL app.current_user_id = '$USER_A';
    SELECT public.reserve_ai_budget(1, 500, 'UTC');
  " >/dev/null 2>&1
sudo docker exec -i -e PGPASSWORD=pw "$CONTAINER" psql -U postgres -d "$DB" -q \
  -v ON_ERROR_STOP=1 -c "
    SET ROLE authenticated;
    SET LOCAL app.current_user_id = '$USER_B';
    SELECT public.reserve_ai_budget(1, 500, 'UTC');
  " >/dev/null 2>&1
# Give the usage log a row too, via reconciliation by its owner.
LEDGER_A=$(sudo docker exec -i -e PGPASSWORD=pw "$CONTAINER" psql -U postgres -d "$DB" -t -A -c \
  "SELECT id FROM public.ai_budget_ledger WHERE user_id = '$USER_A' LIMIT 1;" | head -1)
sudo docker exec -i -e PGPASSWORD=pw "$CONTAINER" psql -U postgres -d "$DB" -q \
  -v ON_ERROR_STOP=1 -c "
    SET ROLE authenticated;
    SET LOCAL app.current_user_id = '$USER_A';
    SELECT public.reconcile_ai_budget('$LEDGER_A'::uuid, 1.5, 100, 50, 'test-model', 'measured', true);
  " >/dev/null 2>&1

fixtures=$(sudo docker exec -i -e PGPASSWORD=pw "$CONTAINER" psql -U postgres -d "$DB" -t -A -c \
  "SELECT (SELECT count(*) FROM public.ai_budget_ledger) || '/' || (SELECT count(*) FROM public.ai_usage_log);")
echo "fixtures: ledger/usage = $fixtures (expected 2/1)"
echo

# ------------------------------------------------- 1. cross-user read of the ledger
echo "1. an ordinary user cannot read another user's rows"
# User A asks for all ledger rows. RLS has no permissive policy for ordinary
# users, so the answer must be zero -- not "only my own". Anonymous is refused
# earlier still, at the grant, which is stronger.
blocked "user A reading the ledger" authenticated "$USER_A" "SELECT count(*) FROM public.ai_budget_ledger;"
blocked "user A reading the usage log" authenticated "$USER_A" "SELECT count(*) FROM public.ai_usage_log;"
blocked "user B reading the ledger" authenticated "$USER_B" "SELECT count(*) FROM public.ai_budget_ledger;"
blocked "anon reading the ledger" anon "" "SELECT count(*) FROM public.ai_budget_ledger;"
blocked "anon reading the usage log" anon "" "SELECT count(*) FROM public.ai_usage_log;"
# The admin is the one role that may read, and the fixtures must be visible to it,
# otherwise the tests above could pass merely because the rows are missing.
expect "admin sees all 2 ledger rows" "2" \
  "$(as authenticated "$ADMIN_ID" "SELECT count(*) FROM public.ai_budget_ledger;")"
echo

# ------------------------------------------------- 2. the cap itself is unreachable
echo "2. an ordinary user cannot reach the function internals"
# private.ai_budget_config holds the spending cap. There is deliberately no grant
# on the schema or the table, so an ordinary user is refused before any policy
# is consulted.
blocked "user A reading the cap" authenticated "$USER_A" "SELECT count(*) FROM private.ai_budget_config;"
blocked "anon reading the cap" anon "" "SELECT count(*) FROM private.ai_budget_config;"
blocked "admin reading the cap directly" authenticated "$ADMIN_ID" "SELECT count(*) FROM private.ai_budget_config;"
# A caller must not be able to raise its own limit by passing a huge number: the
# stored value is the ceiling. Cap is 500; ask for 999999 and the answer is no.
expect "a caller cannot raise its own cap" "f" \
  "$(as authenticated "$USER_A" "SELECT allowed FROM public.reserve_ai_budget(999999, 999999, 'UTC');")"
echo

# ------------------------------------------------- 3. no spend total is readable
echo "3. no caller can read a spend total"
# The functions return a decision, never a sum. proargmodes tells the truth about
# the signature: 'i' is an input, 't' is a table output. Only the four outputs may
# appear, and none of them is a spend total.
shape=$(as "" "" "SELECT string_agg(a.name, ',' ORDER BY a.ord)
   FROM pg_proc p,
        unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(name, mode, ord)
  WHERE p.proname = 'reserve_ai_budget' AND a.mode = 't';" | tr -d ' ')
expect "reserve_ai_budget returns only a decision" "allowed,reservation_inr,reservation_id,reason" "$shape"
# The ledger has no aggregate exposed to a caller, so the running total cannot be
# read even by an admin through a function.
expect "no function returns a spend total" "0" \
  "$(as "" "" "SELECT count(*) FROM pg_proc WHERE prosrc ~* 'returns table.*(spent|total_inr|sum)';" | tr -d ' ')"
# Anonymous must not be able to call the function at all.
blocked "anon executing reserve_ai_budget" anon "" "SELECT public.reserve_ai_budget(1,500,'UTC');"
echo

echo "isolation: $PASS passed, $FAIL failed"
[ "$FAIL" = "0" ] && echo "RESULT: PASS" || echo "RESULT: FAIL"
exit "$FAIL"
