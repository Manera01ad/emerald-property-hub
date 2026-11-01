-- AI usage logging and a global daily spending cap.
--
-- This file is NOT applied automatically. The repository owner runs it.
--
-- The problem it solves: the assistant is the primary entry point, so every
-- visitor can spend money. A per-user limit of 15 messages bounds one person but
-- not the bill, because the number of people is unbounded. Nothing today stops
-- 10,000 visitors from each spending their allowance in the same hour.
--
-- Two tables and two functions:
--   * ai_usage_log   -- one row per paid call, with the cost and whether that
--                       cost was measured or estimated.
--   * ai_budget_ledger -- one row per reservation, so in-flight calls count
--                       against the cap instead of being invisible until they
--                       finish. A burst of concurrent requests is exactly the
--                       case a check-then-spend limit fails.
--
-- The functions return a decision, never a total. That is deliberate: a function
-- that returned today's spend would let any signed-in caller read the business's
-- daily cost, and a public function over a spend column is a cross-user leak.
-- The reserve function reads the ledger, compares against the caller-supplied
-- cap and the owner-set cap, and answers yes or no with a reservation id.
--
-- Nothing here exposes another user's rows. RLS is on both tables with no
-- permissive policy for ordinary users; admins get read access for the control
-- centre. All writes go through the two SECURITY DEFINER functions.
--
-- The budget day is UTC. That is stated in the function, not left to the server
-- default, so the boundary cannot drift with a host timezone.

-- ---------------------------------------------------------------- usage log

CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Null for a call that was refused before it was attributed to a user.
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  model text NOT NULL,
  -- Null when the provider reported no usage. Never a fabricated count.
  input_tokens int CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens int CHECK (output_tokens IS NULL OR output_tokens >= 0),
  -- Null when the model has no published price. Null is not zero: zero would
  -- read as free and would never trip the cap.
  cost_inr numeric(12,4) CHECK (cost_inr IS NULL OR cost_inr >= 0),
  -- 'measured' only when the cost came from real token counts and a known price.
  usage_source text NOT NULL DEFAULT 'estimated'
    CHECK (usage_source IN ('measured', 'estimated')),
  cost_measured boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'ok'
    CHECK (status IN ('ok', 'error', 'aborted', 'refused')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_usage_log_created_idx ON public.ai_usage_log (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_log_user_idx ON public.ai_usage_log (user_id, created_at DESC);

-- ---------------------------------------------------------------- budget ledger

CREATE TABLE IF NOT EXISTS public.ai_budget_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- The UTC day this reservation counts against.
  budget_day date NOT NULL,
  reserved_inr numeric(12,4) NOT NULL CHECK (reserved_inr >= 0),
  -- Null until reconciled. A row with no actual and an old timestamp is
  -- abandoned and released by the sweep inside reserve_ai_budget.
  actual_inr numeric(12,4) CHECK (actual_inr IS NULL OR actual_inr >= 0),
  reconciled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_budget_ledger_day_idx
  ON public.ai_budget_ledger (budget_day, reconciled_at);

-- ---------------------------------------------------------------- reservation

/**
 * Reserve budget for one call. Returns a decision, never a spend total.
 *
 * SECURITY DEFINER so the insert is not blocked by RLS. The search_path is
 * pinned to public, the caller is validated, and EXECUTE is granted only to
 * authenticated, so no anonymous caller can drive it.
 *
 * The advisory lock serialises concurrent reservations for the same day. Without
 * it, two requests can both read the pre-reservation total and both be allowed,
 * which is the classic overspend this exists to prevent.
 */
CREATE OR REPLACE FUNCTION public.reserve_ai_budget(
  _reservation_inr numeric,
  _daily_budget_inr numeric,
  _timezone text DEFAULT 'UTC'
)
RETURNS TABLE (allowed boolean, reservation_inr numeric, reservation_id uuid, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _day date := (now() AT TIME ZONE 'UTC')::date;
  _spent numeric;
  _reserved numeric;
  _cap numeric;
  _id uuid;
BEGIN
  -- Anonymous callers cannot reserve. The assistant already requires a token.
  IF _uid IS NULL THEN
    RETURN QUERY SELECT false, NULL::numeric, NULL::uuid, 'not_authenticated'::text;
    RETURN;
  END IF;

  IF _reservation_inr IS NULL OR _reservation_inr < 0 THEN
    RETURN QUERY SELECT false, NULL::numeric, NULL::uuid, 'invalid_amount'::text;
    RETURN;
  END IF;

  -- The caller passes the configured cap, but the owner's stored value is the
  -- ceiling: a caller cannot raise its own limit by sending a bigger number.
  SELECT COALESCE(
    (SELECT daily_budget_inr FROM private.ai_budget_config WHERE id = 1),
    _daily_budget_inr
  ) INTO _cap;

  IF _cap IS NULL OR _cap <= 0 THEN
    RETURN QUERY SELECT false, _reservation_inr, NULL::uuid, 'budget_exhausted'::text;
    RETURN;
  END IF;

  -- Serialise concurrent reservations for this day.
  PERFORM pg_advisory_xact_lock(hashtext('ai_budget:' || _day::text));

  -- Release reservations abandoned by a crashed or killed request. Five minutes
  -- is well beyond a normal answer, so anything older is dead and its budget
  -- would otherwise be held forever.
  UPDATE public.ai_budget_ledger
     SET reconciled_at = now(), actual_inr = COALESCE(actual_inr, 0)
   WHERE budget_day = _day
     AND reconciled_at IS NULL
     AND created_at < now() - interval '5 minutes';

  SELECT COALESCE(sum(actual_inr), 0) INTO _spent
    FROM public.ai_budget_ledger
   WHERE budget_day = _day AND reconciled_at IS NOT NULL;

  SELECT COALESCE(sum(reserved_inr), 0) INTO _reserved
    FROM public.ai_budget_ledger
   WHERE budget_day = _day AND reconciled_at IS NULL;

  IF _spent + _reserved + _reservation_inr > _cap THEN
    RETURN QUERY SELECT false, _reservation_inr, NULL::uuid, 'budget_exhausted'::text;
    RETURN;
  END IF;

  INSERT INTO public.ai_budget_ledger (user_id, budget_day, reserved_inr)
  VALUES (_uid, _day, _reservation_inr)
  RETURNING id INTO _id;

  RETURN QUERY SELECT true, _reservation_inr, _id, NULL::text;
END $$;

-- ---------------------------------------------------------------- reconciliation

/**
 * Close a reservation with what was actually used, and write the usage row.
 *
 * A NULL actual means the cost could not be determined, so the reservation is
 * kept as the charge rather than zeroed — over-counting is safe, under-counting
 * is not.
 */
CREATE OR REPLACE FUNCTION public.reconcile_ai_budget(
  _reservation_id uuid,
  _actual_inr numeric,
  _input_tokens int DEFAULT NULL,
  _output_tokens int DEFAULT NULL,
  _model text DEFAULT NULL,
  _usage_source text DEFAULT 'estimated',
  _cost_measured boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.ai_budget_ledger;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;

  SELECT * INTO _row FROM public.ai_budget_ledger WHERE id = _reservation_id;
  -- Only the owner of the reservation may close it. Without this, any signed-in
  -- caller could zero out another user's reservation by guessing an id.
  IF _row.id IS NULL OR _row.user_id IS DISTINCT FROM _uid THEN RETURN; END IF;

  UPDATE public.ai_budget_ledger
     SET actual_inr = COALESCE(_actual_inr, _row.reserved_inr),
         reconciled_at = now()
   WHERE id = _reservation_id;

  INSERT INTO public.ai_usage_log (
    user_id, model, input_tokens, output_tokens, cost_inr, usage_source, cost_measured, status
  ) VALUES (
    _uid,
    COALESCE(_model, 'unknown'),
    _input_tokens,
    _output_tokens,
    COALESCE(_actual_inr, _row.reserved_inr),
    CASE WHEN _usage_source = 'measured' THEN 'measured' ELSE 'estimated' END,
    COALESCE(_cost_measured, false),
    'ok'
  );
END $$;

-- ---------------------------------------------------------------- permissions

-- Only signed-in callers. Anonymous execution is revoked explicitly, because
-- PostgreSQL grants EXECUTE to PUBLIC on a new function by default.
REVOKE ALL ON FUNCTION public.reserve_ai_budget(numeric, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reconcile_ai_budget(uuid, numeric, int, int, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_ai_budget(numeric, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_ai_budget(uuid, numeric, int, int, text, text, boolean) TO authenticated;

-- ---------------------------------------------------------------- row level security

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_budget_ledger ENABLE ROW LEVEL SECURITY;

-- No policy for ordinary users: the tables are readable only by admins. A user
-- can see their own usage through the assistant's existing message history, and
-- must never see the running total, which is business information.
DROP POLICY IF EXISTS "admins read usage log" ON public.ai_usage_log;
CREATE POLICY "admins read usage log" ON public.ai_usage_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins read budget ledger" ON public.ai_budget_ledger;
CREATE POLICY "admins read budget ledger" ON public.ai_budget_ledger
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- No INSERT/UPDATE/DELETE policy anywhere: all writes go through the two
-- SECURITY DEFINER functions above, which validate the caller themselves.
GRANT SELECT ON public.ai_usage_log TO authenticated;
GRANT SELECT ON public.ai_budget_ledger TO authenticated;

-- ---------------------------------------------------------------- owner setting

-- The cap lives in the private schema, not app_settings, because app_settings is
-- readable by anon (policy "public read settings"): putting the daily AI budget
-- there would publish the business's spending limit to every visitor. The owner
-- changes it with a single UPDATE, so no deploy is needed.
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.ai_budget_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  daily_budget_inr numeric(12,4) NOT NULL DEFAULT 500 CHECK (daily_budget_inr >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO private.ai_budget_config DEFAULT VALUES ON CONFLICT (id) DO NOTHING;

-- No grants: the table is reachable only from the SECURITY DEFINER functions
-- below, which run as the owner. There is deliberately no public reader.
REVOKE ALL ON private.ai_budget_config FROM PUBLIC;
