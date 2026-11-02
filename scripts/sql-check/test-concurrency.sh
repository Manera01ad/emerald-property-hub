#!/usr/bin/env bash
# Concurrency test for reserve_ai_budget (migration 0021).
#
# The claim under test: the daily cap cannot be exceeded, even when many requests
# arrive at the same instant. This is the case a check-then-spend limit fails, and
# it is the one thing a single-connection test (PGlite, or psql run serially)
# cannot show. Every request below runs on its own connection, started in
# parallel, so they genuinely overlap.
#
# Method: set a small cap, fire N reservations simultaneously, then count how many
# were allowed and what the ledger holds. The pass condition is that the sum of
# reserved amounts never exceeds the cap.
#
# Usage: scripts/sql-check/test-concurrency.sh [N] [CAP] [RESERVATION]

set -uo pipefail

N="${1:-50}"
CAP="${2:-10}"
RES="${3:-1}"
DB="propwise_sqlcheck"
CONTAINER="pw-sqlcheck-pg"
USER_ID="22222222-2222-2222-2222-222222222222"

# One psql invocation, one connection. `psql -c` opens its own session, which is
# what makes the parallelism real rather than simulated.
one() {
  sudo docker exec -i -e PGPASSWORD=pw "$CONTAINER" \
    psql -U postgres -d "$DB" -t -A -v ON_ERROR_STOP=1 -c "$1" 2>&1
}

echo "concurrency test: $N simultaneous reservations, cap $CAP, each $RES"
echo

# ---------------------------------------------------------------- setup
one "DELETE FROM public.ai_budget_ledger; DELETE FROM public.ai_usage_log;" >/dev/null
one "UPDATE private.ai_budget_config SET daily_budget_inr = $CAP WHERE id = 1;" >/dev/null

# Every reservation runs as the same ordinary signed-in user, because the cap is
# global: it must hold for one user making a burst of requests, not just for many
# users making one each.
CALL="SET LOCAL app.current_user_id = '$USER_ID'; SELECT allowed FROM public.reserve_ai_budget($RES, $CAP, 'UTC');"

# A fresh file per run. Appending to a fixed path would let an earlier run's
# output (including a shell trace from a debugging run) be counted as results.
OUT=$(mktemp)
trap 'rm -f "$OUT"' EXIT

echo "firing $N requests in parallel..."
start=$(date +%s%N)
for i in $(seq 1 "$N"); do
  one "$CALL" >> "$OUT" 2>&1 &
done
wait
end=$(date +%s%N)
echo "  done in $(( (end - start) / 1000000 )) ms"
echo

# ---------------------------------------------------------------- results
allowed=$(grep -c "^t$" $OUT || true)
denied=$(grep -c "^f$" $OUT || true)
# `SET LOCAL app.current_user_id` prints "SET" for each session; that is expected
# plumbing, not a result. Anything else that is not t/f is a real surprise.
errors=$(grep -viE "^(t|f|SET)$" $OUT | grep -vE "^\s*$" | head -5 || true)

echo "allowed : $allowed"
echo "denied  : $denied"
echo "total   : $(( allowed + denied )) of $N"
if [ -n "$errors" ]; then
  echo "unexpected output:"
  echo "$errors" | sed 's/^/  /'
fi
echo

# The ledger is the record of what was actually committed. Reserved rows are
# in-flight; reconciled rows are finished. Both count against the cap.
read -r reserved_rows reserved_sum reconciled_rows reconciled_sum total <<EOF
$(one "SELECT count(*) FILTER (WHERE reconciled_at IS NULL),
               COALESCE(sum(reserved_inr) FILTER (WHERE reconciled_at IS NULL), 0),
               count(*) FILTER (WHERE reconciled_at IS NOT NULL),
               COALESCE(sum(actual_inr) FILTER (WHERE reconciled_at IS NOT NULL), 0),
               COALESCE(sum(COALESCE(actual_inr, reserved_inr)), 0)
          FROM public.ai_budget_ledger;" | tr '|' ' ')
EOF

echo "ledger: $reserved_rows in-flight (sum $reserved_sum), $reconciled_rows settled (sum $reconciled_sum)"
echo "ledger total committed: $total   cap: $CAP"
echo

# ---------------------------------------------------------------- verdict
fail=0
if [ "$(( allowed + denied ))" != "$N" ]; then
  echo "FAIL: $N requests were sent but $(( allowed + denied )) returned a decision"
  fail=1
fi
# The whole point. Compare as integers in rupees to avoid float noise.
if [ "$(printf '%.0f' "$total")" -gt "$(printf '%.0f' "$CAP")" ]; then
  echo "FAIL: committed $total exceeds the cap of $CAP -- the limit leaked"
  fail=1
else
  echo "PASS: committed $total never exceeded the cap of $CAP"
fi
# A cap that allows everything proves nothing. With cap 10 and reservation 1 the
# expectation is exactly 10 allowed.
expected_allowed=$(printf '%.0f' "$(echo "$CAP / $RES" | bc -l 2>/dev/null || echo 0)")
if [ "$expected_allowed" -gt 0 ] && [ "$allowed" -ne "$expected_allowed" ]; then
  echo "NOTE: expected $expected_allowed allowed (cap $CAP / $RES), got $allowed"
fi
if [ "$allowed" -eq 0 ] && [ "$N" -gt 0 ]; then
  echo "FAIL: nothing was allowed; the test did not exercise the limit"
  fail=1
fi

echo
[ "$fail" = "0" ] && echo "RESULT: PASS" || echo "RESULT: FAIL"
exit "$fail"
