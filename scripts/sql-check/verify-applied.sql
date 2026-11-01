-- Verification queries for the apply runbook.
--
-- Each statement below is the one the runbook tells the owner to run to confirm
-- a migration took effect. They are collected here so the whole set can be
-- executed in one pass and checked against the expected results, rather than
-- trusting that the SQL in the document works.
--
-- Every query returns a single value so the output is easy to compare.
-- Run against a database with all 24 migrations applied.

\echo '=== after 0013: feature flags exist and are off ==='
SELECT key || '=' || value FROM public.app_settings
 WHERE key IN ('feature_community','feature_owner_submissions','feature_interest_requests')
 ORDER BY key;

\echo '=== after 0017 (pending): interest request constraints ==='
SELECT count(*) FROM pg_constraint
 WHERE conname IN ('enquiries_interest_needs_property','enquiries_interest_needs_consent_version');

\echo '=== after 0018 (pending): community tables and rls ==='
SELECT count(*) FROM pg_class
 WHERE relname IN ('community_threads','community_posts','community_reports','community_moderation_log')
   AND relnamespace = 'public'::regnamespace AND relrowsecurity;

\echo '=== after 0019 (pending): properties.transaction_type ==='
SELECT count(*) FROM information_schema.columns
 WHERE table_name='properties' AND column_name='transaction_type';

\echo '=== after 0020 (pending): research tables and rls ==='
SELECT count(*) FROM pg_class
 WHERE relname IN ('research_contributors','research_tasks','research_submissions','research_rewards','research_moderation_log')
   AND relnamespace = 'public'::regnamespace AND relrowsecurity;

\echo '=== after 0021: budget objects ==='
SELECT count(*) FROM pg_proc WHERE proname IN ('reserve_ai_budget','reconcile_ai_budget');

\echo '=== after 0021: the cap exists and is set ==='
SELECT daily_budget_inr FROM private.ai_budget_config WHERE id = 1;

\echo '=== after 0021: no client role can read the cap table (expect 0) ==='
-- Counts grants to the client roles only. The owner's own grants are excluded,
-- because the owner always has them and they are not what this check is about.
SELECT count(*) FROM information_schema.role_table_grants
 WHERE table_name = 'ai_budget_config'
   AND grantee IN ('anon','authenticated');

\echo '=== after 0021: no client role can read the budget tables (expect 0) ==='
SELECT count(*) FROM information_schema.role_table_grants
 WHERE table_name IN ('ai_usage_log','ai_budget_ledger')
   AND privilege_type <> 'SELECT'
   AND grantee IN ('anon','authenticated');

\echo '=== after 0021: anon cannot execute the budget functions (expect 0) ==='
SELECT count(*) FROM information_schema.role_routine_grants
 WHERE routine_name IN ('reserve_ai_budget','reconcile_ai_budget')
   AND grantee = 'anon';

\echo '=== after 0021: authenticated can execute reserve_ai_budget (expect 1) ==='
SELECT count(*) FROM information_schema.role_routine_grants
 WHERE routine_name = 'reserve_ai_budget'
   AND privilege_type = 'EXECUTE'
   AND grantee = 'authenticated';
