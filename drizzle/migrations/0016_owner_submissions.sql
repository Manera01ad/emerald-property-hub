-- Phase 1 W3-1. Owner and developer submissions, moderated before anything public.
--
-- This file is NOT applied automatically. The repository owner runs it.
--
-- Design notes:
--   * A submission is private. The submitter reads their own rows, admins read all,
--     and there is no public read policy, so a pending submission can never leak.
--   * Contact details stay on the submission and are never copied to the public
--     properties table, so no buyer query can return them.
--   * Approval is a database function so the property row, the submission status and
--     the audit row change together, or not at all. The new property is created as a
--     draft with listing_permission = true and permission_evidence pointing at the
--     declaration: an admin still has to publish it deliberately.
--   * Limits (3 per day, 3 active) are enforced by a trigger, not only by the form.

CREATE TABLE public.listing_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitter_kind text NOT NULL CHECK (submitter_kind IN ('owner','developer')),
  submitter_name text NOT NULL CHECK (char_length(submitter_name) BETWEEN 1 AND 120),
  contact_phone text NOT NULL CHECK (char_length(contact_phone) BETWEEN 6 AND 20),
  contact_email text NOT NULL CHECK (char_length(contact_email) BETWEEN 3 AND 200),
  rera_number text,
  locality_slug text NOT NULL REFERENCES public.localities(slug) ON DELETE RESTRICT,
  property_type text NOT NULL CHECK (property_type IN ('villa','independent_house','resale_home','apartment','plot')),
  bedrooms int CHECK (bedrooms IS NULL OR bedrooms >= 0),
  built_area_sqft numeric CHECK (built_area_sqft IS NULL OR built_area_sqft > 0),
  land_area_sqft numeric CHECK (land_area_sqft IS NULL OR land_area_sqft > 0),
  asking_price numeric CHECK (asking_price IS NULL OR asking_price >= 0),
  description text CHECK (description IS NULL OR char_length(description) <= 2000),
  declaration_version text NOT NULL,
  declared_at timestamptz NOT NULL DEFAULT now(),
  declaration_text text NOT NULL CHECK (char_length(declaration_text) BETWEEN 20 AND 2000),
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','in_review','approved','needs_changes','rejected')),
  review_reason text CHECK (review_reason IS NULL OR char_length(review_reason) <= 1000),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT developer_needs_rera CHECK (
    submitter_kind <> 'developer' OR (rera_number IS NOT NULL AND char_length(trim(rera_number)) >= 6)
  ),
  CONSTRAINT reason_when_not_approved CHECK (
    status IN ('submitted','in_review','approved') OR review_reason IS NOT NULL
  )
);
CREATE INDEX listing_submissions_submitter_idx ON public.listing_submissions (submitter_id, created_at DESC);
CREATE INDEX listing_submissions_queue_idx ON public.listing_submissions (status, created_at);

GRANT SELECT, INSERT, UPDATE ON public.listing_submissions TO authenticated;
GRANT ALL ON public.listing_submissions TO service_role;
ALTER TABLE public.listing_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "submitter reads own submissions" ON public.listing_submissions FOR SELECT TO authenticated
  USING (auth.uid() = submitter_id);
CREATE POLICY "submitter creates own submissions" ON public.listing_submissions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = submitter_id AND status = 'submitted' AND reviewed_by IS NULL AND review_reason IS NULL);
CREATE POLICY "admins manage submissions" ON public.listing_submissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER listing_submissions_touch BEFORE UPDATE ON public.listing_submissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- A submitter may hold three open submissions and send three in a day.
CREATE OR REPLACE FUNCTION public.check_listing_submission_limits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE open_count int; day_count int;
BEGIN
  SELECT count(*) INTO open_count FROM public.listing_submissions
    WHERE submitter_id = NEW.submitter_id AND status IN ('submitted','in_review','needs_changes');
  IF open_count >= 3 THEN
    RAISE EXCEPTION 'You already have three submissions open. Wait for those to be reviewed.';
  END IF;
  SELECT count(*) INTO day_count FROM public.listing_submissions
    WHERE submitter_id = NEW.submitter_id AND created_at > now() - interval '24 hours';
  IF day_count >= 3 THEN
    RAISE EXCEPTION 'Three submissions in a day is the limit. Please try again tomorrow.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER listing_submissions_limits BEFORE INSERT ON public.listing_submissions
  FOR EACH ROW EXECUTE FUNCTION public.check_listing_submission_limits();

-- Only these transitions are allowed, and only an admin can make them.
CREATE OR REPLACE FUNCTION public.check_submission_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status <> OLD.status THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Only an admin can change a submission status.';
    END IF;
    IF NOT (
      (OLD.status = 'submitted' AND NEW.status IN ('in_review','approved','needs_changes','rejected')) OR
      (OLD.status = 'in_review' AND NEW.status IN ('approved','needs_changes','rejected')) OR
      (OLD.status = 'needs_changes' AND NEW.status IN ('in_review','rejected'))
    ) THEN
      RAISE EXCEPTION 'A submission cannot move from % to %.', OLD.status, NEW.status;
    END IF;
    NEW.reviewed_by := auth.uid();
    NEW.reviewed_at := now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER listing_submissions_transition BEFORE UPDATE ON public.listing_submissions
  FOR EACH ROW EXECUTE FUNCTION public.check_submission_transition();

CREATE TABLE public.listing_moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.listing_submissions(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  from_status text,
  to_status text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX listing_moderation_log_submission_idx ON public.listing_moderation_log (submission_id, created_at);
GRANT SELECT ON public.listing_moderation_log TO authenticated;
GRANT ALL ON public.listing_moderation_log TO service_role;
ALTER TABLE public.listing_moderation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read moderation log" ON public.listing_moderation_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.log_submission_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> OLD.status THEN
    INSERT INTO public.listing_moderation_log (submission_id, actor_id, from_status, to_status, reason)
    VALUES (NEW.id, auth.uid(), OLD.status, NEW.status, NEW.review_reason);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER listing_submissions_log AFTER UPDATE ON public.listing_submissions
  FOR EACH ROW EXECUTE FUNCTION public.log_submission_transition();

-- Approval: create the draft property from the submission, in one transaction.
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
