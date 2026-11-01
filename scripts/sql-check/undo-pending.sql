-- Reverse the five migrations in drizzle/pending/, newest first.
--
-- DESTRUCTIVE. Every statement below drops objects and their data. This file is
-- not run by any script and is not part of the test suite; it exists so the undo
-- SQL printed in docs/APPLY_RUNBOOK.md can be executed and checked rather than
-- copied by hand.
--
-- Before running this against a real project, take a snapshot. Restoring the
-- snapshot is safer than a partial reverse migration, because it does not depend
-- on this file being complete.
--
-- It is checked by scripts/sql-check/test-undo.sh, which applies every migration,
-- runs this file, and compares the result against a database that never had the
-- pending migrations applied at all.

-- ---------------------------------------------------------------------- 0021
DROP FUNCTION IF EXISTS public.reconcile_ai_budget(uuid, numeric, int, int, text, text, boolean);
DROP FUNCTION IF EXISTS public.reserve_ai_budget(numeric, numeric, text);
DROP TABLE IF EXISTS public.ai_usage_log;
DROP TABLE IF EXISTS public.ai_budget_ledger;
DROP TABLE IF EXISTS private.ai_budget_config;
-- The private schema itself stays: migration 0004 already uses it for
-- private.scheduler_token, which predates this work.

-- ---------------------------------------------------------------------- 0020
DROP TABLE IF EXISTS public.research_rewards;
DROP TABLE IF EXISTS public.research_submissions;
DROP TABLE IF EXISTS public.research_tasks;
DROP TABLE IF EXISTS public.research_contributors;
DROP TABLE IF EXISTS public.research_moderation_log;
-- The tables' functions and triggers go with the tables, but the functions are
-- not owned by them, so they need dropping in their own right.
DROP FUNCTION IF EXISTS public.accept_research_submission(uuid, text);
DROP FUNCTION IF EXISTS public.reject_research_submission(uuid, text);
DROP FUNCTION IF EXISTS public.research_no_self_review();
DROP FUNCTION IF EXISTS public.research_contributor_guard();
DROP FUNCTION IF EXISTS public.research_submission_rate_limit();

-- ---------------------------------------------------------------------- 0019
-- 0019 is the widest of the five: it adds lease terms to three tables, widens
-- two check constraints, and replaces approve_listing_submission. Dropping the
-- constraints before the columns they reference keeps the order valid.

-- community rooms
ALTER TABLE public.community_threads DROP COLUMN IF EXISTS transaction_type;
ALTER TABLE public.community_threads DROP CONSTRAINT IF EXISTS community_threads_category_check;
ALTER TABLE public.community_threads ADD CONSTRAINT community_threads_category_check
  CHECK (category IN ('localities','buying','documents','construction','general'));

-- owner submissions
ALTER TABLE public.listing_submissions DROP CONSTRAINT IF EXISTS listing_submissions_plot_is_sale_only;
ALTER TABLE public.listing_submissions DROP CONSTRAINT IF EXISTS listing_submissions_transaction_type_check;
ALTER TABLE public.listing_submissions
  DROP COLUMN IF EXISTS transaction_type,
  DROP COLUMN IF EXISTS deposit,
  DROP COLUMN IF EXISTS maintenance_monthly,
  DROP COLUMN IF EXISTS furnishing,
  DROP COLUMN IF EXISTS available_from,
  DROP COLUMN IF EXISTS lease_months,
  DROP COLUMN IF EXISTS escalation_pct,
  DROP COLUMN IF EXISTS permitted_use,
  DROP COLUMN IF EXISTS renewal_terms;

-- seeker intent
ALTER TABLE public.buyer_profiles DROP COLUMN IF EXISTS lease_months;
ALTER TABLE public.buyer_profiles DROP COLUMN IF EXISTS permitted_use;
ALTER TABLE public.buyer_profiles DROP CONSTRAINT IF EXISTS buyer_profiles_intent_check;
ALTER TABLE public.buyer_profiles
  ADD CONSTRAINT buyer_profiles_intent_check CHECK (intent IN ('buy','rent'));

-- properties
ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS properties_buy_has_no_lease_terms;
ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS properties_plot_is_sale_only;
ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS properties_transaction_type_check;
DROP INDEX IF EXISTS public.properties_transaction_type_idx;
ALTER TABLE public.properties
  DROP COLUMN IF EXISTS transaction_type,
  DROP COLUMN IF EXISTS deposit,
  DROP COLUMN IF EXISTS maintenance_monthly,
  DROP COLUMN IF EXISTS furnishing,
  DROP COLUMN IF EXISTS available_from,
  DROP COLUMN IF EXISTS lease_months,
  DROP COLUMN IF EXISTS escalation_pct,
  DROP COLUMN IF EXISTS permitted_use,
  DROP COLUMN IF EXISTS renewal_terms;

-- approve_listing_submission must go back to the 0018 body, which is the whole
-- reason this statement is here: the 0019 version reads s.transaction_type and
-- the lease columns, so once those columns are gone it fails at run time rather
-- than at creation. PostgreSQL resolves plpgsql column references on execution,
-- not on creation, so without this the function would exist but throw when used.
CREATE OR REPLACE FUNCTION public.approve_listing_submission(_submission_id uuid, _title text, _reason text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.listing_submissions; new_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only an admin can approve a submission.';
  END IF;
  SELECT * INTO s FROM public.listing_submissions WHERE id = _submission_id FOR UPDATE;
  IF s IS NULL THEN RAISE EXCEPTION 'Submission not found.'; END IF;
  IF s.status NOT IN ('submitted','in_review') THEN
    RAISE EXCEPTION 'Only a submitted or in-review listing can be approved.';
  END IF;
  IF _title IS NULL OR char_length(trim(_title)) < 5 THEN
    RAISE EXCEPTION 'A public title of at least five characters is required.';
  END IF;

  INSERT INTO public.properties (
    title, property_type, location, asking_price, bedrooms, built_area_sqft, land_area_sqft,
    description, status, is_demo, verification_status, listing_permission, permission_evidence, source, rera_number
  ) VALUES (
    trim(_title), s.property_type, (SELECT name FROM public.localities WHERE slug = s.locality_slug),
    coalesce(s.asking_price, 0), s.bedrooms, s.built_area_sqft, s.land_area_sqft,
    s.description, 'draft', false, 'unverified', true,
    'Owner declaration ' || s.declaration_version || ' accepted ' || to_char(s.declared_at, 'YYYY-MM-DD'),
    'owner_submitted', s.rera_number
  ) RETURNING id INTO new_id;

  UPDATE public.listing_submissions
    SET status = 'approved', review_reason = _reason, created_property_id = new_id
    WHERE id = _submission_id;

  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.approve_listing_submission(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.approve_listing_submission(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------- 0018
DROP TABLE IF EXISTS public.community_moderation_log;
DROP TABLE IF EXISTS public.community_reports;
DROP TABLE IF EXISTS public.community_posts;
DROP TABLE IF EXISTS public.community_threads;
-- As above: dropping the tables removes the triggers, not the functions they call.
-- public.touch_updated_at is deliberately NOT dropped -- it predates this work and
-- other tables depend on it.
DROP FUNCTION IF EXISTS public.community_text_is_clean(text);
DROP FUNCTION IF EXISTS public.check_community_text();
DROP FUNCTION IF EXISTS public.community_initial_status(uuid);
DROP FUNCTION IF EXISTS public.community_set_initial_status();
DROP FUNCTION IF EXISTS public.check_community_rate_limit();
DROP FUNCTION IF EXISTS public.community_apply_report();
DROP FUNCTION IF EXISTS public.community_log_status_change();
DROP FUNCTION IF EXISTS public.community_log_delete();

-- ---------------------------------------------------------------------- 0017
-- Restores the enquiries insert policy to its 0002 wording. That wording is less
-- strict than 0017's: it does not exclude enquiry_type = 'interest', and the two
-- guards below are dropped, so an anonymous insert can no longer be checked for a
-- property or a consent version. Reversing 0017 reopens that path deliberately.
DROP POLICY IF EXISTS "signed in request interest" ON public.enquiries;
DROP POLICY IF EXISTS "anyone submit enquiry" ON public.enquiries;
CREATE POLICY "anyone submit enquiry" ON public.enquiries FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'new' AND admin_notes IS NULL AND assigned_consultant IS NULL AND consent = true);
ALTER TABLE public.enquiries DROP CONSTRAINT IF EXISTS enquiries_interest_needs_consent_version;
ALTER TABLE public.enquiries DROP CONSTRAINT IF EXISTS enquiries_interest_needs_property;
ALTER TABLE public.enquiries DROP CONSTRAINT IF EXISTS enquiries_enquiry_type_check;
ALTER TABLE public.enquiries ADD CONSTRAINT enquiries_enquiry_type_check
  CHECK (enquiry_type IN ('consultation','site_visit'));
ALTER TABLE public.enquiries DROP COLUMN IF EXISTS consent_version;
