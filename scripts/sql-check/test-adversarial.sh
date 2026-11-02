#!/usr/bin/env bash
# Adversarial probe of the budget accounting in 0021.
#
# A browser can call any endpoint the server exposes, and the server passes the
# caller's own token. So the question this script asks is: what can a signed-in
# caller do by calling the budget functions directly, rather than through the
# assistant's own code path?
#
# Two probes:
#   1. Can a caller free their own budget by reserving a lot and then reconciling
#      the reservation to almost nothing, over and over?
#   2. Does reconciling the same reservation twice record the cost twice, which
#      would let a retried request inflate the day's spend?
#
# Neither probe is a break-in: both are the intended function being called by its
# intended caller. The point is whether the accounting survives it.
#
# Usage: scripts/sql-check/test-adversarial.sh

set -uo pipefail

DB="propwise_sqlcheck"
CONTAINER="pw-sqlcheck-pg"
USER_A="22222222-2222-2222-2222-222222222222"

q() { sudo docker exec -i -e PGPASSWORD=pw "$CONTAINER" psql -U postgres -d "$DB" -t -A -c "$1" 2>&1 | grep -vE '^(SET|RESET)$'; }
asA() { sudo docker exec -i -e PGPASSWORD=pw "$CONTAINER" psql -U postgres -d "$DB" -t -A -c "SET ROLE authenticated; SET LOCAL app.current_user_id='$USER_A'; $1" 2>&1 | grep -vE '^(SET|RESET)$'; }

FINDINGS=0

echo "adversarial probe of the AI budget accounting"
echo

# ------------------------------------------------------------------ probe 1
echo "1. can a caller free its own budget by reconciling to almost nothing?"
q "DELETE FROM public.ai_budget_ledger; DELETE FROM public.ai_usage_log;
   UPDATE private.ai_budget_config SET daily_budget_inr = 10 WHERE id = 1;" >/dev/null
echo "   cap is 10; each reservation asks for 5, so at most 2 should ever fit"
allowed=0
for i in $(seq 1 6); do
  rid=$(asA "SELECT reservation_id FROM public.reserve_ai_budget(5, 10, 'UTC');" | tr -d ' ')
  if echo "$rid" | grep -qE '^[0-9a-f-]{36}$'; then
    allowed=$((allowed+1))
    # Reconcile to almost nothing, as a caller that wants its budget back.
    asA "SELECT public.reconcile_ai_budget('$rid'::uuid, 0.01, 1, 1, 'probe', 'measured', true);" >/dev/null
    printf '   round %d: allowed (reservation %s)\n' "$i" "$rid"
  else
    printf '   round %d: refused\n' "$i"
  fi
done
spend=$(q "SELECT COALESCE(sum(actual_inr),0) FROM public.ai_budget_ledger;" | tr -d ' ')
echo "   allowed: $allowed of 6; reconciled spend: $spend; cap: 10"
if [ "$allowed" -gt 2 ]; then
  echo "   FINDING F1: a caller made $allowed calls against a cap that fits 2."
  echo "               The cap bounds concurrent reservations, not completed spend."
  FINDINGS=$((FINDINGS+1))
else
  echo "   OK: the cap held across sequential rounds."
fi
echo

# ------------------------------------------------------------------ probe 2
echo "2. does reconciling the same reservation twice double-count the cost?"
q "DELETE FROM public.ai_budget_ledger; DELETE FROM public.ai_usage_log;" >/dev/null
rid=$(asA "SELECT reservation_id FROM public.reserve_ai_budget(5, 500, 'UTC');" | tr -d ' ')
asA "SELECT public.reconcile_ai_budget('$rid'::uuid, 4, 100, 50, 'probe', 'measured', true);" >/dev/null
n1=$(q "SELECT count(*) FROM public.ai_usage_log;" | tr -d ' ')
c1=$(q "SELECT COALESCE(sum(cost_inr),0) FROM public.ai_usage_log;" | tr -d ' ')
asA "SELECT public.reconcile_ai_budget('$rid'::uuid, 4, 100, 50, 'probe', 'measured', true);" >/dev/null
n2=$(q "SELECT count(*) FROM public.ai_usage_log;" | tr -d ' ')
c2=$(q "SELECT COALESCE(sum(cost_inr),0) FROM public.ai_usage_log;" | tr -d ' ')
echo "   after one reconcile: $n1 usage row(s), total cost $c1"
echo "   after two:           $n2 usage row(s), total cost $c2"
if [ "$n2" != "$n1" ]; then
  echo "   FINDING F2: the second reconcile logged again. Cost went $c1 -> $c2."
  echo "               The ledger is unaffected (the UPDATE sets actual_inr rather than"
  echo "               adding to it, so the cap still holds), but ai_usage_log -- the"
  echo "               table used for cost reporting -- double-counts the call."
  FINDINGS=$((FINDINGS+1))
else
  echo "   OK: the second reconcile was a no-op."
fi
echo
echo "recorded $FINDINGS finding(s); see docs/SQL_TEST_FINDINGS.md"
# A finding is a property of the SQL, not a crash. The suite exits 0 so that
# "the migrations applied and behaved as written" stays separable from "the
# migrations are good enough to rely on".
exit 0
