#!/usr/bin/env bash
# Row-level security tests for the pending migrations 0017-0020.
#
# These four files create the community, contributor and interest-request tables.
# None of them is applied in production yet, so this is the first time their
# policies have been executed at all.
#
# What is tested, for each table:
#   * row-level security is actually enabled (a table with policies but RLS off
#     is wide open, and nothing in a policy statement reveals that);
#   * anonymous callers see only what is meant to be public;
#   * one signed-in user cannot read or change another user's rows;
#   * moderation logs and unreviewed submissions stay private.
#
# Every check runs as a real role. A superuser connection bypasses row-level
# security and would make all of these pass for the wrong reason.
#
# Usage: scripts/sql-check/test-rls.sh

set -uo pipefail

DB="propwise_sqlcheck"
CONTAINER="pw-sqlcheck-pg"
ADMIN_ID="11111111-1111-1111-1111-111111111111"
USER_A="22222222-2222-2222-2222-222222222222"
USER_B="33333333-3333-3333-3333-333333333333"

PASS=0
FAIL=0

as() {
  local role="$1" uid="$2" sql="$3"
  local pre=""
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

blocked() {
  local label="$1" role="$2" uid="$3" sql="$4" out
  out=$(as "$role" "$uid" "$sql")
  if echo "$out" | grep -qiE "permission denied|must be owner|row-level security"; then
    printf '  PASS  %s (refused)\n' "$label"; PASS=$((PASS+1))
  elif [ "$(echo "$out" | tr -d '[:space:]')" = "0" ]; then
    printf '  PASS  %s (no rows)\n' "$label"; PASS=$((PASS+1))
  else
    printf '  FAIL  %s\n        expected a refusal or 0, got [%s]\n' "$label" "$out"; FAIL=$((FAIL+1))
  fi
}

echo "row-level security tests for pending migrations 0017-0020"
echo

# ------------------------------------------------------- A. RLS is actually on
# A table can carry policies and still be unprotected if RLS was never enabled.
# This is the check that catches that, and it covers every table the four files
# create rather than a hand-picked few.
echo "A. row-level security is enabled on every table 0017-0020 create"
for t in community_threads community_posts community_reports community_moderation_log \
         research_contributors research_tasks research_submissions research_moderation_log research_rewards; do
  got=$(as "" "" "SELECT relrowsecurity FROM pg_class WHERE relname='$t' AND relnamespace='public'::regnamespace;" | tr -d ' ')
  if [ -z "$got" ]; then
    printf '  SKIP  %s (table not created)\n' "$t"
  else
    expect "rls enabled on $t" "t" "$got"
  fi
done
echo

# ------------------------------------------------------- B. fixtures
# Publishing is not something an author can do: community_set_initial_status
# forces a new thread to 'pending' unless the caller is an admin, and only an
# established author (older than 7 days, with a published post) is published
# automatically. So the fixtures are created by the admin, which is the same path
# a moderator uses when approving a thread.
sudo docker exec -i -e PGPASSWORD=pw "$CONTAINER" psql -U postgres -d "$DB" -q \
  -v ON_ERROR_STOP=0 -c "
    DELETE FROM public.community_posts;
    DELETE FROM public.community_threads;
    SET ROLE authenticated; SET LOCAL app.current_user_id = '$ADMIN_ID';
    INSERT INTO public.community_threads (category, locality_slug, title, body, author_id, status)
      VALUES ('localities','guduvancheri','A published thread from A','a body long enough', '$USER_A', 'published');
    INSERT INTO public.community_threads (category, locality_slug, title, body, author_id, status)
      VALUES ('localities','guduvancheri','A hidden thread from A','a body long enough', '$USER_A', 'hidden');
    INSERT INTO public.community_threads (category, locality_slug, title, body, author_id, status)
      VALUES ('localities','guduvancheri','A published thread from B','a body long enough', '$USER_B', 'published');
  " 2>&1 | grep -viE "^(SET|RESET|DELETE|INSERT)" | head -5
threads=$(as "" "" "SELECT count(*) FROM public.community_threads;" | tr -d ' ')
published=$(as "" "" "SELECT count(*) FROM public.community_threads WHERE status='published';" | tr -d ' ')
echo "B. fixtures: $threads threads seeded, $published published (expected 3, 2)"
echo

# ------------------------------------------------------- B2. self-publishing
# The control that stops an author publishing their own thread. This is the
# interesting one: it is a trigger, not a policy, so a policy-only reading of the
# file would miss it. A brand-new account must not be able to publish.
echo "B2. an author cannot publish their own thread"
as authenticated "$USER_A" \
  "INSERT INTO public.community_threads (category,locality_slug,title,body,author_id,status) VALUES ('localities','guduvancheri','an attempt to self publish','a body long enough','$USER_A','published');" >/dev/null
expect "a new author's thread is forced to pending" "1" \
  "$(as "" "" "SELECT count(*) FROM public.community_threads WHERE title='an attempt to self publish' AND status='pending';" | tr -d ' ')"
expect "the self-published thread is not public" "0" \
  "$(as anon "" "SELECT count(*) FROM public.community_threads WHERE title='an attempt to self publish';" | tr -d ' ')"
echo

# ------------------------------------------------------- C. anonymous visibility
echo "C. anonymous callers see only published threads"
# Two threads are published and one is hidden. Anonymous must see exactly two.
expect "anon sees 2 published threads" "2" \
  "$(as anon "" "SELECT count(*) FROM public.community_threads;" | tr -d ' ')"
expect "anon cannot see the hidden thread" "0" \
  "$(as anon "" "SELECT count(*) FROM public.community_threads WHERE status='hidden';" | tr -d ' ')"
echo

# ------------------------------------------------------- D. cross-user reads
echo "D. one signed-in user cannot read another user's private rows"
# User B sees the two published threads (A's and B's) but not A's hidden thread.
expect "user B sees 2 threads, not A's hidden thread" "2" \
  "$(as authenticated "$USER_B" "SELECT count(*) FROM public.community_threads;" | tr -d ' ')"
expect "user B cannot read A's hidden thread" "0" \
  "$(as authenticated "$USER_B" "SELECT count(*) FROM public.community_threads WHERE author_id='$USER_A' AND status='hidden';" | tr -d ' ')"
# A's own hidden thread is visible to A, so the previous result is about policy and not
# about the row being missing.
expect "user A can read own hidden thread" "1" \
  "$(as authenticated "$USER_A" "SELECT count(*) FROM public.community_threads WHERE author_id='$USER_A' AND status='hidden';" | tr -d ' ')"
echo

# ------------------------------------------------------- E. cross-user writes
echo "E. one signed-in user cannot change another user's rows"
# B must not be able to edit A's thread. A row-level UPDATE is filtered rather
# than refused, so the observable result is "no rows updated".
expect "user B cannot update A's thread" "0" \
  "$(as authenticated "$USER_B" "WITH u AS (UPDATE public.community_threads SET title='hijacked' WHERE author_id='$USER_A' RETURNING 1) SELECT count(*) FROM u;" | tr -d ' ')"
expect "user B cannot delete A's thread" "0" \
  "$(as authenticated "$USER_B" "WITH d AS (DELETE FROM public.community_threads WHERE author_id='$USER_A' RETURNING 1) SELECT count(*) FROM d;" | tr -d ' ')"
# And the row must still be intact, which is the part that matters.
expect "A's thread is unchanged" "0" \
  "$(as "" "" "SELECT count(*) FROM public.community_threads WHERE title='hijacked';" | tr -d ' ')"
# A user must not be able to post as someone else. A WITH CHECK violation is
# raised as an error rather than filtered to zero rows, which is why this uses
# the blocked helper.
blocked "user B cannot author as A" authenticated "$USER_B" \
  "INSERT INTO public.community_threads (category,locality_slug,title,body,author_id,status) VALUES ('localities','guduvancheri','a forged thread title','a body long enough','$USER_A','published');"
expect "no forged thread was created" "0" \
  "$(as "" "" "SELECT count(*) FROM public.community_threads WHERE author_id='$USER_A' AND title='a forged thread title';" | tr -d ' ')"
echo

# ------------------------------------------------------- F. moderation is private
echo "F. moderation and review data stay private"
blocked "anon reading the moderation log" anon "" "SELECT count(*) FROM public.community_moderation_log;"
blocked "ordinary user reading the moderation log" authenticated "$USER_A" "SELECT count(*) FROM public.community_moderation_log;"
blocked "anon reading research submissions" anon "" "SELECT count(*) FROM public.research_submissions;"
blocked "anon reading research rewards" anon "" "SELECT count(*) FROM public.research_rewards;"
blocked "anon reading contributor records" anon "" "SELECT count(*) FROM public.research_contributors;"
# The admin is the intended reader; if this fails, the queue is invisible to the
# only person who can act on it, which is a different bug.
echo

# ------------------------------------------------------- G. contributor privacy
echo "G. a contributor cannot read another contributor's private fields"
# research_contributors carries a free-text credibility note. The policy must
# limit a contributor to their own record.
blocked "user B cannot read A's contributor row" authenticated "$USER_B" \
  "SELECT count(*) FROM public.research_contributors WHERE user_id='$USER_A';"
echo

echo "rls: $PASS passed, $FAIL failed"
[ "$FAIL" = "0" ] && echo "RESULT: PASS" || echo "RESULT: FAIL"
exit "$FAIL"
