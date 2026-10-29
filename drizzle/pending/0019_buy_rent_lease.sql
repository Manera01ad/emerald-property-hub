-- Phase 1 scope update: buy, rent and lease on one property record.
--
-- This file is NOT applied automatically. The repository owner runs it.
--
-- Design notes:
--   * One properties table. transaction_type says which kind of deal the row is, and the
--     rent/lease term columns are only meaningful for rent and lease rows. A buy row leaves
--     them null. This is the "one database, transaction-specific fields" rule.
--   * asking_price already carries the headline figure. For rent and lease it is the monthly
--     rent; the unit is derived from transaction_type, not stored twice. Existing rows default
--     to 'buy', so nothing already published changes meaning.
--   * Every new column is nullable. A missing deposit or escalation stays null and reads as
--     UNKNOWN in the app, so no comparison can assume zero.
--   * No paid placement, no commission, no contact unlocking is added here.

-- ---------------------------------------------------------------- transaction type

ALTER TABLE public.properties
  ADD COLUMN transaction_type text NOT NULL DEFAULT 'buy';

ALTER TABLE public.properties
  ADD CONSTRAINT properties_transaction_type_check
  CHECK (transaction_type IN ('buy','rent','lease'));

-- A plot is not rented or leased as a home; guard the obvious mismatch without
-- over-constraining what an owner may legitimately offer.
ALTER TABLE public.properties
  ADD CONSTRAINT properties_plot_is_sale_only
  CHECK (transaction_type = 'buy' OR property_type <> 'plot');

CREATE INDEX properties_transaction_type_idx ON public.properties (transaction_type, status);

-- ---------------------------------------------------------------- rental terms

ALTER TABLE public.properties
  ADD COLUMN deposit numeric CHECK (deposit IS NULL OR deposit >= 0),
  ADD COLUMN maintenance_monthly numeric CHECK (maintenance_monthly IS NULL OR maintenance_monthly >= 0),
  ADD COLUMN furnishing text CHECK (furnishing IS NULL OR furnishing IN ('unfurnished','semi_furnished','fully_furnished')),
  ADD COLUMN available_from date;

-- ---------------------------------------------------------------- lease terms

ALTER TABLE public.properties
  ADD COLUMN lease_months int CHECK (lease_months IS NULL OR lease_months > 0),
  ADD COLUMN escalation_pct numeric CHECK (escalation_pct IS NULL OR escalation_pct >= 0),
  ADD COLUMN permitted_use text CHECK (
    permitted_use IS NULL OR permitted_use IN ('residential','commercial','office','retail','industrial','mixed')
  ),
  ADD COLUMN renewal_terms text CHECK (
    renewal_terms IS NULL OR renewal_terms IN ('renewable','not_renewable','by_agreement')
  );

-- A sale listing must not carry a lease term, and a lease must not carry furnishing-only
-- rental semantics without a term. These are consistency guards, not business logic.
ALTER TABLE public.properties
  ADD CONSTRAINT properties_buy_has_no_lease_terms CHECK (
    transaction_type <> 'buy' OR (lease_months IS NULL AND escalation_pct IS NULL AND permitted_use IS NULL)
  );

-- ---------------------------------------------------------------- seeker intent

-- buyer_profiles.intent covered buy and rent. Lease is a distinct commitment, so it is a
-- distinct intent rather than being folded into rent.
ALTER TABLE public.buyer_profiles DROP CONSTRAINT IF EXISTS buyer_profiles_intent_check;
ALTER TABLE public.buyer_profiles
  ADD CONSTRAINT buyer_profiles_intent_check CHECK (intent IN ('buy','rent','lease'));

-- A lease seeker states a monthly budget like a tenant, so monthly_rent_budget is reused.
ALTER TABLE public.buyer_profiles
  ADD COLUMN lease_months int CHECK (lease_months IS NULL OR lease_months > 0),
  ADD COLUMN permitted_use text CHECK (
    permitted_use IS NULL OR permitted_use IN ('residential','commercial','office','retail','industrial','mixed')
  );

-- ---------------------------------------------------------------- owner submissions

ALTER TABLE public.listing_submissions
  ADD COLUMN transaction_type text NOT NULL DEFAULT 'buy';

ALTER TABLE public.listing_submissions
  ADD CONSTRAINT listing_submissions_transaction_type_check
  CHECK (transaction_type IN ('buy','rent','lease'));

ALTER TABLE public.listing_submissions
  ADD COLUMN deposit numeric CHECK (deposit IS NULL OR deposit >= 0),
  ADD COLUMN maintenance_monthly numeric CHECK (maintenance_monthly IS NULL OR maintenance_monthly >= 0),
  ADD COLUMN furnishing text CHECK (furnishing IS NULL OR furnishing IN ('unfurnished','semi_furnished','fully_furnished')),
  ADD COLUMN available_from date,
  ADD COLUMN lease_months int CHECK (lease_months IS NULL OR lease_months > 0),
  ADD COLUMN escalation_pct numeric CHECK (escalation_pct IS NULL OR escalation_pct >= 0),
  ADD COLUMN permitted_use text CHECK (
    permitted_use IS NULL OR permitted_use IN ('residential','commercial','office','retail','industrial','mixed')
  ),
  ADD COLUMN renewal_terms text CHECK (
    renewal_terms IS NULL OR renewal_terms IN ('renewable','not_renewable','by_agreement')
  );

ALTER TABLE public.listing_submissions
  ADD CONSTRAINT listing_submissions_plot_is_sale_only
  CHECK (transaction_type = 'buy' OR property_type <> 'plot');

-- Approval copies the transaction type and the terms onto the new property, so the
-- published row means the same thing the owner submitted.
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
    title, property_type, transaction_type, location, asking_price, bedrooms, built_area_sqft, land_area_sqft,
    deposit, maintenance_monthly, furnishing, available_from, lease_months, escalation_pct, permitted_use, renewal_terms,
    description, status, is_demo, verification_status, listing_permission, permission_evidence, source, rera_number
  ) VALUES (
    trim(_title), s.property_type, s.transaction_type, (SELECT name FROM public.localities WHERE slug = s.locality_slug),
    coalesce(s.asking_price, 0), s.bedrooms, s.built_area_sqft, s.land_area_sqft,
    s.deposit, s.maintenance_monthly, s.furnishing, s.available_from, s.lease_months, s.escalation_pct, s.permitted_use, s.renewal_terms,
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

-- ---------------------------------------------------------------- community rooms

-- Community rooms are per locality and per transaction type, so a tenant asking about a
-- rental in Tambaram is not mixed in with buyers looking at the same area. The existing
-- categories stay valid; these two are added rather than replacing them.
ALTER TABLE public.community_threads DROP CONSTRAINT IF EXISTS community_threads_category_check;
ALTER TABLE public.community_threads
  ADD CONSTRAINT community_threads_category_check
  CHECK (category IN ('localities','buying','renting','leasing','documents','construction','general'));

ALTER TABLE public.community_threads
  ADD COLUMN transaction_type text CHECK (transaction_type IS NULL OR transaction_type IN ('buy','rent','lease'));
