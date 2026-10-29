-- Phase 1 W3-2. Interest requests on approved owner listings.
--
-- This file is NOT applied automatically. The repository owner runs it.
--
-- An interest request is an enquiry of type 'interest'. It is allowed only for a
-- signed-in user, only with consent = true, and only against a specific listing, so
-- it can never be used as an anonymous contact form.
--
-- The public enquiries form keeps working exactly as before (same consent and
-- consultant checks as 0002): the widened type is
-- excluded from the anonymous insert policy, and no query returns owner contact
-- details to a buyer at any point.

ALTER TABLE public.enquiries DROP CONSTRAINT IF EXISTS enquiries_enquiry_type_check;
ALTER TABLE public.enquiries ADD CONSTRAINT enquiries_enquiry_type_check
  CHECK (enquiry_type IN ('consultation','site_visit','interest'));

-- The wording a buyer accepted is stored with the request, so we can always show what was agreed.
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS consent_version text;
ALTER TABLE public.enquiries ADD CONSTRAINT enquiries_interest_needs_property CHECK (
  enquiry_type <> 'interest' OR property_id IS NOT NULL
);
ALTER TABLE public.enquiries ADD CONSTRAINT enquiries_interest_needs_consent_version CHECK (
  enquiry_type <> 'interest' OR consent_version IS NOT NULL
);

-- Anonymous and general inserts may not raise an interest request.
-- The consent and consultant checks come from 0002_site_visits_and_crm_fields and
-- must be kept: without them a visitor could submit without consent or pre-assign
-- their enquiry to a consultant.
DROP POLICY IF EXISTS "anyone submit enquiry" ON public.enquiries;
CREATE POLICY "anyone submit enquiry" ON public.enquiries FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'new'
    AND admin_notes IS NULL
    AND assigned_consultant IS NULL
    AND consent = true
    AND enquiry_type <> 'interest'
  );

-- Interest requests: signed in, consenting, tied to a listing, and always new.
CREATE POLICY "signed in request interest" ON public.enquiries FOR INSERT TO authenticated
  WITH CHECK (
    enquiry_type = 'interest'
    AND auth.uid() IS NOT NULL
    AND consent = true
    AND property_id IS NOT NULL
    AND consent_version IS NOT NULL
    AND status = 'new'
    AND admin_notes IS NULL
    AND assigned_consultant IS NULL
  );
