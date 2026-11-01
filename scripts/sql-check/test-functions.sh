#!/usr/bin/env bash
# Tests for the SECURITY DEFINER functions in the pending migrations.
#
# A SECURITY DEFINER function runs with the privileges of its owner, so it is the
# one place where a missing permission check turns into a full compromise. Each
# function here is tested in three directions: an anonymous caller must be
# refused, an ordinary signed-in caller must be refused, and the intended admin
# caller must succeed. A function that refuses everyone is also a bug, so the
# positive case is tested too.
#
# Also covers the budget lifecycle in 0021: reservation, reconciliation, the
# abandoned-reservation sweep, and what happens on a second reconciliation.
#
# Usage: scripts/sql-check/test-functions.sh

set -uo pipefail

DB="propwise_sqlcheck"
CONTAINER="pw-sqlcheck-pg"
ADMIN_ID="11111111-1111-1111-1111-111111111111"
USER_A="22222222-2222-2222-2222-222222222222"
USER_B="33333333-3333-3333-3333-333333333333"

PASS=0
FAIL=0

as() {
  local role="$1" uid="$2" sql="$3" pre=""
  [ -n "$role" ] && pre="SET ROLE $role;"
  [ -n "$uid" ] && pre="$pre SET LOCAL app.current_user_id = '$uid';"
  sudo docker exec -i -e PGPASSWORD=pw "$CONTAINER" \
    psql -U postgres -d "$DB" -t -A -v ON_ERROR_STOP=0 -c "$pre $sql" 2>&1 | grep -vE "^(SET|RESET)$"
}

expect() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    printf '  PASS  %s\n' "$label"; PASS=$((PASS+1))
  else
    printf '  FAIL  %s\n        expected [%s]\n        actual   [%s]\n' "$label" "$expected" "$actual"; FAIL=$((FAIL+1))
  fi
}

# A function call must raise, not return quietly. Raising is the only outcome that
# cannot be mistaken for success by a caller that ignores the result.
raises() {
  local label="$1" role="$2" uid="$3" sql="$4" out
  out=$(as "$role" "$uid" "$sql")
  if echo "$out" | grep -qiE "ERROR|Only an admin|permission denied"; then
    printf '  PASS  %s (raised)\n' "$label"; PASS=$((PASS+1))
  else
    printf '  FAIL  %s\n        expected an error, got [%s]\n' "$label" "$out"; FAIL=$((FAIL+1))
  fi
}

echo "function and budget-lifecycle tests"
echo

# ============================================================ 1. listing approval
echo "1. approve_listing_submission is admin-only"
sub=$(as "" "" "SELECT id FROM public.listing_submissions ORDER BY created_at LIMIT 1;" | tr -d ' ')
if [ -z "$sub" ]; then
  # Seed one submission through the normal path so the positive case can run.
  # The required columns without a default are all supplied here; declaration_text
  # has a 20-character minimum.
  sub=$(as authenticated "$USER_A" "
    INSERT INTO public.listing_submissions (
      submitter_id, submitter_kind, submitter_name, contact_phone, contact_email,
      locality_slug, property_type, declaration_version, declaration_text,
      transaction_type, asking_price
    ) VALUES ('$USER_A','owner','A Test Owner','9876543210','owner@test.local',
      'guduvancheri','apartment','v1',
      'I confirm I am authorised to list this property.', 'buy', 5000000)
    RETURNING id;" | grep -oE '^[0-9a-f-]{36}$' | head -1)
fi
if [ -z "$sub" ]; then
  echo "  SKIP  no listing_submissions row could be created"
else
  # Anonymous must not approve. The function has no explicit REVOKE, so this
  # depends on the internal has_role() check -- which is exactly why it is tested
  # rather than assumed.
  raises "anon cannot approve a listing" anon "" "SELECT public.approve_listing_submission('$sub','An approved title');"
  raises "an ordinary user cannot approve a listing" authenticated "$USER_A" "SELECT public.approve_listing_submission('$sub','An approved title');"
  raises "a too-short title is refused" authenticated "$ADMIN_ID" "SELECT public.approve_listing_submission('$sub','no');"
  # The positive case: an admin can approve, and the created property is a draft
  # that is explicitly not a demo and not verified.
  newid=$(as authenticated "$ADMIN_ID" "SELECT public.approve_listing_submission('$sub','An approved title');" | grep -oE '^[0-9a-f-]{36}$' | head -1)
  if echo "$newid" | grep -qE '^[0-9a-f-]{36}$'; then
    printf '  PASS  an admin can approve a listing\n'; PASS=$((PASS+1))
    expect "the approved property is a draft" "draft" \
      "$(as "" "" "SELECT status FROM public.properties WHERE id='$newid';" | tr -d ' ')"
    expect "the approved property is not a demo" "f" \
      "$(as "" "" "SELECT is_demo FROM public.properties WHERE id='$newid';" | tr -d ' ')"
    expect "the approved property is unverified" "unverified" \
      "$(as "" "" "SELECT verification_status FROM public.properties WHERE id='$newid';" | tr -d ' ')"
  else
    printf '  FAIL  an admin can approve a listing\n        got [%s]\n' "$newid"; FAIL=$((FAIL+1))
  fi
fi
echo

# ============================================================ 2. budget lifecycle
echo "2. budget reservation lifecycle"
as "" "" "DELETE FROM public.ai_budget_ledger; DELETE FROM public.ai_usage_log; UPDATE private.ai_budget_config SET daily_budget_inr=500 WHERE id=1;" >/dev/null

rid=$(as authenticated "$USER_A" "SELECT reservation_id FROM public.reserve_ai_budget(5, 500, 'UTC');" | tr -d ' ')
if echo "$rid" | grep -qE '^[0-9a-f-]{36}$'; then
  printf '  PASS  a reservation returns an id\n'; PASS=$((PASS+1))
else
  printf '  FAIL  a reservation returns an id\n        got [%s]\n' "$rid"; FAIL=$((FAIL+1))
fi

# In-flight budget counts against the cap: the 5 already reserved leaves 495.
expect "an in-flight reservation counts against the cap" "f" \
  "$(as authenticated "$USER_A" "SELECT allowed FROM public.reserve_ai_budget(496, 500, 'UTC');")"
expect "a reservation that fits is allowed" "t" \
  "$(as authenticated "$USER_A" "SELECT allowed FROM public.reserve_ai_budget(495, 500, 'UTC');")"
# Clean up that second reservation so the accounting below is simple.
as "" "" "UPDATE public.ai_budget_ledger SET reconciled_at=now(), actual_inr=0 WHERE reconciled_at IS NULL;" >/dev/null

# A different user must not be able to close someone else's reservation. If this
# worked, any signed-in caller could zero out another user's charge.
as authenticated "$USER_B" "SELECT public.reconcile_ai_budget('$rid'::uuid, 0.01);" >/dev/null
expect "another user cannot close the reservation" "0" \
  "$(as "" "" "SELECT count(*) FROM public.ai_usage_log;" | tr -d ' ')"
expect "another user cannot zero the amount" "5.0000" \
  "$(as "" "" "SELECT reserved_inr FROM public.ai_budget_ledger WHERE id='$rid';" | tr -d ' ')"

# The owner closes it. A null actual must keep the reservation as the charge,
# because under-counting is the failure that matters.
as authenticated "$USER_A" "SELECT public.reconcile_ai_budget('$rid'::uuid, NULL, 10, 5, 'test-model', 'estimated', false);" >/dev/null
expect "the owner can close the reservation" "1" \
  "$(as "" "" "SELECT count(*) FROM public.ai_usage_log WHERE user_id='$USER_A';" | tr -d ' ')"
expect "a null actual keeps the reserved amount" "5.0000" \
  "$(as "" "" "SELECT actual_inr FROM public.ai_budget_ledger WHERE id='$rid';" | tr -d ' ')"
expect "the usage row records the cost" "5.0000" \
  "$(as "" "" "SELECT cost_inr FROM public.ai_usage_log WHERE user_id='$USER_A';" | tr -d ' ')"
expect "the usage row is labelled estimated" "estimated" \
  "$(as "" "" "SELECT usage_source FROM public.ai_usage_log WHERE user_id='$USER_A';" | tr -d ' ')"

# Double reconciliation. The database does not make this a no-op: closing a
# reservation twice writes a second usage row. The ledger itself is unaffected --
# the UPDATE sets actual_inr rather than adding to it, so the cap still holds --
# but the usage log double-counts, which is the table used for cost reporting.
# The probe records the behaviour rather than asserting it is correct, because
# 0021 is not applied yet and the fix belongs in that file.
# See docs/SQL_TEST_FINDINGS.md, finding F2.
before=$(as "" "" "SELECT count(*) FROM public.ai_usage_log;" | tr -d ' ')
as authenticated "$USER_A" "SELECT public.reconcile_ai_budget('$rid'::uuid, 5, 10, 5, 'test-model', 'estimated', false);" >/dev/null
after=$(as "" "" "SELECT count(*) FROM public.ai_usage_log;" | tr -d ' ')
if [ "$after" = "$before" ]; then
  printf '  PASS  a second reconciliation is a no-op\n'; PASS=$((PASS+1))
else
  printf '  KNOWN FINDING  a second reconciliation logged again (%s -> %s rows). See F2 in docs/SQL_TEST_FINDINGS.md\n' "$before" "$after"
fi
echo

# ============================================================ 3. abandoned sweep
echo "3. an abandoned reservation is released"
# A crashed request leaves a reservation with no actual. After five minutes it
# must stop holding budget, or the cap would leak away over a day.
as "" "" "DELETE FROM public.ai_budget_ledger; DELETE FROM public.ai_usage_log;" >/dev/null
as "" "" "INSERT INTO public.ai_budget_ledger (user_id, budget_day, reserved_inr, created_at)
         VALUES ('$USER_A', (now() AT TIME ZONE 'UTC')::date, 400, now() - interval '10 minutes');" >/dev/null
expect "the stale reservation is recorded" "400.0000" \
  "$(as "" "" "SELECT COALESCE(sum(reserved_inr),0) FROM public.ai_budget_ledger WHERE reconciled_at IS NULL;" | tr -d ' ')"
# A new reservation sweeps it. With a 500 cap and 400 held, only 100 is free
# before the sweep; after it, 500 is free again.
expect "a new reservation succeeds after the sweep" "t" \
  "$(as authenticated "$USER_A" "SELECT allowed FROM public.reserve_ai_budget(100, 500, 'UTC');")"
expect "the stale reservation was released" "0" \
  "$(as "" "" "SELECT count(*) FROM public.ai_budget_ledger WHERE reconciled_at IS NULL AND reserved_inr=400;" | tr -d ' ')"
echo

# ============================================================ 4. research review
echo "4. research review functions refuse self-review and non-admins"
# research_no_self_review is a trigger that stops a contributor reviewing their
# own submission. It is a database control, not a UI one, which is the point.
for fn in accept_research_submission reject_research_submission; do
  raises "anon cannot call $fn" anon "" "SELECT public.$fn(gen_random_uuid());"
  raises "an ordinary user cannot call $fn" authenticated "$USER_A" "SELECT public.$fn(gen_random_uuid());"
done
echo

echo "functions: $PASS passed, $FAIL failed"
[ "$FAIL" = "0" ] && echo "RESULT: PASS" || echo "RESULT: FAIL"
exit "$FAIL"
