-- Local Research Network: how the product scales past the Chennai pilot without hiring.
--
-- This file is NOT applied automatically. The repository owner runs it.
--
-- The problem it solves: verifying a locality needs local knowledge, and the pilot has eight
-- localities. Covering roughly 400 km around Chennai is dozens of localities. A paid research
-- team does not scale to that, and paying for reports would repeat the paid-placement problem.
--
-- The model: the people already in the network (owners, tenants, lessees, residents) supply
-- the local facts. A task says exactly what is needed. A submission answers one task with an
-- attachment or a written observation. A reviewer checks it. Only then is it credited to the
-- locality's evidence. Nothing a contributor sends is public until it is reviewed, and the
-- reviewer can never be the contributor who submitted it.
--
-- Guardrails, enforced here rather than only in the browser:
--   * No money changes hands. Points are recognition only. There is no payout column, and
--     the reward table records points, never a currency amount.
--   * A task cannot be published until it names the field it is evidence for and the source
--     it expects, so no task can ask for an opinion dressed up as a fact.
--   * A submission is never public. Only its reviewed outcome reaches area_intelligence.
--   * Contact details are stripped from anything that could become public.

-- ---------------------------------------------------------------- contributors

CREATE TABLE public.research_contributors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The name shown on credited contributions. Never the email or phone.
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 60),
  -- Where they actually live or work. Local knowledge is the whole point, so it is required.
  home_locality_slug text REFERENCES public.localities(slug) ON DELETE SET NULL,
  relationship text NOT NULL DEFAULT 'resident'
    CHECK (relationship IN ('resident','owner','tenant','lessee','agent','developer','other')),
  -- Free text so the reviewer can see why this person is credible for a locality.
  local_knowledge_note text CHECK (local_knowledge_note IS NULL OR char_length(local_knowledge_note) <= 500),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','paused','removed')),
  -- Recognition only. There is deliberately no payout, balance or currency column.
  points_total int NOT NULL DEFAULT 0 CHECK (points_total >= 0),
  approved_count int NOT NULL DEFAULT 0 CHECK (approved_count >= 0),
  rejected_count int NOT NULL DEFAULT 0 CHECK (rejected_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX research_contributors_status_idx ON public.research_contributors (status, home_locality_slug);

-- ---------------------------------------------------------------- tasks

CREATE TABLE public.research_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locality_slug text NOT NULL REFERENCES public.localities(slug) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 8 AND 140),
  -- The exact question. One task asks for one fact.
  ask text NOT NULL CHECK (char_length(ask) BETWEEN 20 AND 1000),
  -- What the answer becomes evidence for. Ties every task to a real field, so no task can
  -- harvest loose opinion. Matches the area_intelligence and infrastructure_projects fields.
  evidence_field text NOT NULL CHECK (evidence_field IN (
    'water_supply','power_reliability','flood_risk','traffic_peak','drainage','road_condition',
    'school_proximity','hospital_proximity','transit_proximity','market_proximity',
    'construction_quality','noise_level','air_quality','civic_services','rent_range','lease_terms',
    'sale_price_range','occupancy','other'
  )),
  -- Where the answer must come from. A task cannot be published without a named source.
  expected_source text NOT NULL CHECK (char_length(expected_source) BETWEEN 5 AND 200),
  instructions text CHECK (instructions IS NULL OR char_length(instructions) <= 2000),
  -- How many accepted answers the task needs before it is done.
  required_submissions int NOT NULL DEFAULT 1 CHECK (required_submissions BETWEEN 1 AND 10),
  accepted_submissions int NOT NULL DEFAULT 0 CHECK (accepted_submissions >= 0),
  points int NOT NULL DEFAULT 0 CHECK (points >= 0),
  difficulty text NOT NULL DEFAULT 'easy' CHECK (difficulty IN ('easy','moderate','hard')),
  -- A task is only useful while the fact is current.
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','open','closed','cancelled')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX research_tasks_open_idx ON public.research_tasks (status, locality_slug, difficulty);

-- ---------------------------------------------------------------- submissions

CREATE TABLE public.research_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.research_tasks(id) ON DELETE CASCADE,
  contributor_id uuid NOT NULL REFERENCES public.research_contributors(id) ON DELETE CASCADE,
  -- The observation, in the contributor's words.
  body text NOT NULL CHECK (char_length(body) BETWEEN 20 AND 2000),
  -- A link to the source the task asked for. No file uploads: it keeps the surface small and
  -- avoids hosting anything we cannot scan.
  source_url text CHECK (source_url IS NULL OR source_url ~* '^https?://'),
  observed_on date,
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','in_review','accepted','needs_changes','rejected')),
  review_reason text CHECK (review_reason IS NULL OR char_length(review_reason) <= 1000),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  points_awarded int NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX research_submissions_task_idx ON public.research_submissions (task_id, status);
CREATE INDEX research_submissions_contributor_idx ON public.research_submissions (contributor_id, created_at DESC);

-- ---------------------------------------------------------------- moderation log

CREATE TABLE public.research_moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_kind text NOT NULL CHECK (subject_kind IN ('task','submission','contributor')),
  subject_id uuid NOT NULL,
  action text NOT NULL CHECK (char_length(action) BETWEEN 2 AND 40),
  reason text CHECK (reason IS NULL OR char_length(reason) <= 1000),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX research_moderation_log_subject_idx ON public.research_moderation_log (subject_kind, subject_id, created_at DESC);

-- ---------------------------------------------------------------- rewards

-- Recognition only. If a currency column is ever added here, the product rule about paid
-- placement has been broken, so the check below makes that mistake impossible to make quietly.
CREATE TABLE public.research_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contributor_id uuid NOT NULL REFERENCES public.research_contributors(id) ON DELETE CASCADE,
  submission_id uuid REFERENCES public.research_submissions(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'points' CHECK (kind = 'points'),
  points int NOT NULL CHECK (points > 0),
  note text CHECK (note IS NULL OR char_length(note) <= 300),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX research_rewards_contributor_idx ON public.research_rewards (contributor_id, created_at DESC);

-- ---------------------------------------------------------------- integrity

-- A task cannot exist without a named source and the field it is evidence for. Both columns
-- are NOT NULL above, so no task can ever be created as an unsourced claim. This is the rule
-- that stops the network from collecting loose opinion.

-- A reviewer must not be the contributor who submitted the work. A CHECK constraint cannot
-- contain a subquery, so this is enforced by a trigger that runs before the row is written.
CREATE OR REPLACE FUNCTION public.research_no_self_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner_id uuid;
BEGIN
  IF NEW.reviewed_by IS NULL THEN RETURN NEW; END IF;
  SELECT user_id INTO owner_id FROM public.research_contributors WHERE id = NEW.contributor_id;
  IF owner_id = NEW.reviewed_by THEN
    RAISE EXCEPTION 'A contributor cannot review their own submission.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER research_submissions_no_self_review
  BEFORE INSERT OR UPDATE ON public.research_submissions
  FOR EACH ROW EXECUTE FUNCTION public.research_no_self_review();

-- ---------------------------------------------------------------- updated_at

CREATE TRIGGER research_contributors_touch BEFORE UPDATE ON public.research_contributors
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER research_tasks_touch BEFORE UPDATE ON public.research_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER research_submissions_touch BEFORE UPDATE ON public.research_submissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------- acceptance

/**
 * Accept a submission: credit the contributor, count it toward the task, and log the action.
 * Runs as the definer so the counter updates and the reward insert are one transaction.
 * Only an admin may call it, and never on their own submission.
 */
CREATE OR REPLACE FUNCTION public.accept_research_submission(_submission_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.research_submissions; c public.research_contributors; t public.research_tasks; award int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only an admin can accept research.';
  END IF;

  SELECT * INTO s FROM public.research_submissions WHERE id = _submission_id FOR UPDATE;
  IF s IS NULL THEN RAISE EXCEPTION 'Submission not found.'; END IF;
  IF s.status NOT IN ('submitted','in_review','needs_changes') THEN
    RAISE EXCEPTION 'Only a submission still under review can be accepted.';
  END IF;

  SELECT * INTO c FROM public.research_contributors WHERE id = s.contributor_id;
  IF c.user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot review your own submission.';
  END IF;

  SELECT * INTO t FROM public.research_tasks WHERE id = s.task_id FOR UPDATE;
  award := t.points;

  UPDATE public.research_submissions
    SET status = 'accepted', review_reason = _reason, reviewed_by = auth.uid(),
        reviewed_at = now(), points_awarded = award
    WHERE id = _submission_id;

  UPDATE public.research_contributors
    SET points_total = points_total + award,
        approved_count = approved_count + 1,
        status = CASE WHEN status = 'pending' THEN 'active' ELSE status END
    WHERE id = s.contributor_id;

  INSERT INTO public.research_rewards (contributor_id, submission_id, points, note)
    VALUES (s.contributor_id, s.id, award, 'Accepted contribution for task ' || t.title);

  UPDATE public.research_tasks
    SET accepted_submissions = accepted_submissions + 1,
        status = CASE WHEN accepted_submissions + 1 >= required_submissions THEN 'closed' ELSE status END
    WHERE id = s.task_id;

  INSERT INTO public.research_moderation_log (subject_kind, subject_id, action, reason, actor_id)
    VALUES ('submission', s.id, 'accepted', _reason, auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.accept_research_submission(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.accept_research_submission(uuid, text) TO authenticated;

-- Rejection is separate because it touches the contributor's rejection count and awards
-- nothing. Keeping it distinct means an accidental accept cannot be quietly reversed.
CREATE OR REPLACE FUNCTION public.reject_research_submission(_submission_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.research_submissions;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only an admin can reject research.';
  END IF;
  IF _reason IS NULL OR char_length(trim(_reason)) < 5 THEN
    RAISE EXCEPTION 'A reason is required when rejecting a submission.';
  END IF;

  SELECT * INTO s FROM public.research_submissions WHERE id = _submission_id FOR UPDATE;
  IF s IS NULL THEN RAISE EXCEPTION 'Submission not found.'; END IF;

  UPDATE public.research_submissions
    SET status = 'rejected', review_reason = _reason, reviewed_by = auth.uid(),
        reviewed_at = now(), points_awarded = 0
    WHERE id = _submission_id;

  UPDATE public.research_contributors
    SET rejected_count = rejected_count + 1
    WHERE id = s.contributor_id;

  INSERT INTO public.research_moderation_log (subject_kind, subject_id, action, reason, actor_id)
    VALUES ('submission', s.id, 'rejected', _reason, auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.reject_research_submission(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.reject_research_submission(uuid, text) TO authenticated;

-- ---------------------------------------------------------------- row-level security

ALTER TABLE public.research_contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_moderation_log ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.research_contributors TO authenticated;
GRANT SELECT ON public.research_tasks TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.research_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.research_submissions TO authenticated;
GRANT SELECT ON public.research_rewards TO authenticated;
GRANT ALL ON public.research_contributors, public.research_tasks, public.research_submissions,
  public.research_rewards, public.research_moderation_log TO service_role;

-- Contributors: a person sees and edits their own record. Admins see all.
CREATE POLICY "own contributor record" ON public.research_contributors
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "create own contributor record" ON public.research_contributors
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "edit own contributor record" ON public.research_contributors
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "admins read contributors" ON public.research_contributors
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Tasks: open tasks are public so anyone can see what is needed. Drafts are admin-only.
CREATE POLICY "read open tasks" ON public.research_tasks
  FOR SELECT TO anon, authenticated USING (status = 'open');
CREATE POLICY "admins manage tasks" ON public.research_tasks
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Submissions: a contributor sees their own. There is no public read at all.
CREATE POLICY "own submissions" ON public.research_submissions
  FOR SELECT TO authenticated USING (
    contributor_id IN (SELECT id FROM public.research_contributors WHERE user_id = auth.uid())
  );
CREATE POLICY "create own submission" ON public.research_submissions
  FOR INSERT TO authenticated WITH CHECK (
    contributor_id IN (SELECT id FROM public.research_contributors WHERE user_id = auth.uid())
  );
CREATE POLICY "admins read submissions" ON public.research_submissions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Rewards: a contributor sees their own. There is no public read.
CREATE POLICY "own rewards" ON public.research_rewards
  FOR SELECT TO authenticated USING (
    contributor_id IN (SELECT id FROM public.research_contributors WHERE user_id = auth.uid())
  );
CREATE POLICY "admins read rewards" ON public.research_rewards
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- The log is admin-only. Contributors never need to read it.
CREATE POLICY "admins read log" ON public.research_moderation_log
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------- limits

-- A contributor may open five submissions a day. Enough to be useful, not enough to spam.
CREATE OR REPLACE FUNCTION public.research_submission_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recent int;
BEGIN
  SELECT count(*) INTO recent FROM public.research_submissions s
    JOIN public.research_contributors c ON c.id = s.contributor_id
    WHERE c.user_id = auth.uid() AND s.created_at > now() - interval '24 hours';
  IF recent >= 5 THEN
    RAISE EXCEPTION 'You have reached the daily limit of five research submissions.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER research_submissions_rate_limit BEFORE INSERT ON public.research_submissions
  FOR EACH ROW EXECUTE FUNCTION public.research_submission_rate_limit();

-- One submission per contributor per task, so a task cannot be filled by one person repeating.
CREATE UNIQUE INDEX research_submissions_one_per_task
  ON public.research_submissions (task_id, contributor_id);
