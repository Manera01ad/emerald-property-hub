CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE public.research_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('licensed_feed','partner_api','developer_site','owner_submitted','public_webpage','government','google_maps','test_fixture')),
  url text NOT NULL,
  access_method text NOT NULL CHECK (access_method IN ('json_feed','fixture','google_places','manual')),
  permission_status text NOT NULL DEFAULT 'pending' CHECK (permission_status IN ('pending','authorised','denied','expired')),
  permission_evidence text,
  permitted_usage text,
  can_publish boolean NOT NULL DEFAULT false,
  refresh_hours integer NOT NULL DEFAULT 24 CHECK (refresh_hours BETWEEN 1 AND 720),
  rate_limit_per_run integer NOT NULL DEFAULT 50 CHECK (rate_limit_per_run BETWEEN 1 AND 500),
  enabled boolean NOT NULL DEFAULT false,
  last_checked_at timestamptz,
  last_status text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.source_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.research_sources(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  source_url text,
  title text,
  property_type text,
  location text,
  address text,
  asking_price numeric,
  land_area_sqft numeric,
  built_area_sqft numeric,
  bedrooms integer,
  seller_name text,
  listed_at date,
  source_updated_at date,
  rera_claim text,
  approval_claims text[] NOT NULL DEFAULT '{}',
  availability text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  missing_since timestamptz,
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','approved','rejected','quarantined','duplicate')),
  quality_flags text[] NOT NULL DEFAULT '{}',
  quality_checked_at timestamptz,
  duplicate_of_property uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  duplicate_of_observation uuid REFERENCES public.source_observations(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  analysis jsonb,
  analysed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, external_id)
);

CREATE TABLE public.price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id uuid NOT NULL REFERENCES public.source_observations(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  price numeric,
  previous_price numeric,
  change_type text NOT NULL CHECK (change_type IN ('initial','increase','reduction','content_change','missing','reappeared')),
  observed_at timestamptz NOT NULL DEFAULT now(),
  source_url text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX price_history_obs_idx ON public.price_history(observation_id, observed_at DESC);

CREATE TABLE public.research_agents (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),
  interval_hours integer NOT NULL DEFAULT 24,
  max_items_per_run integer NOT NULL DEFAULT 50,
  monthly_cost_cap_usd numeric NOT NULL DEFAULT 5,
  cost_month text,
  api_calls_month integer NOT NULL DEFAULT 0,
  est_cost_month numeric NOT NULL DEFAULT 0,
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_status text,
  last_error text,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0
);

CREATE TABLE public.research_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_key text NOT NULL REFERENCES public.research_agents(key) ON DELETE CASCADE,
  trigger text NOT NULL CHECK (trigger IN ('schedule','manual','retry')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','failed','skipped')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  items_processed integer NOT NULL DEFAULT 0,
  api_calls integer NOT NULL DEFAULT 0,
  est_cost numeric NOT NULL DEFAULT 0,
  message text,
  error text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX research_runs_started_idx ON public.research_runs(started_at DESC);

ALTER TABLE public.infrastructure_projects
  ADD COLUMN authority text,
  ADD COLUMN published_on date,
  ADD COLUMN source_id uuid REFERENCES public.research_sources(id) ON DELETE SET NULL,
  ADD COLUMN external_ref text;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['research_sources','source_observations','price_history','research_agents','research_runs'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "admin all %s" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin'')) WITH CHECK (public.has_role(auth.uid(), ''admin''))', t, t);
  END LOOP;
END $$;

CREATE TRIGGER source_observations_touch BEFORE UPDATE ON public.source_observations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.research_agents (key, name, description, interval_hours, max_items_per_run, monthly_cost_cap_usd) VALUES
 ('discovery','Discovery','Finds new listings in enabled, authorised sources.',24,100,0),
 ('price_monitor','Price monitoring','Rechecks known listings for price, content and availability changes.',24,200,0),
 ('quality','Quality','Detects duplicates, contradictions and stale or unreliable records; quarantines bad data.',24,500,0),
 ('deal_analysis','Deal analysis','Price per sq ft, total cost, comparable asking prices and a transparent score.',24,500,0),
 ('location','Location intelligence','Nearby schools, hospitals and transport via Google Maps (straight-line distances).',168,3,5),
 ('infrastructure','Government infrastructure','Monitors authorised official sources for infrastructure updates.',168,50,0);

-- Scheduler token: lives only in a non-API schema; cron reads it, the route verifies it.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
CREATE TABLE private.scheduler_token (id int PRIMARY KEY DEFAULT 1 CHECK (id = 1), token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'));
INSERT INTO private.scheduler_token DEFAULT VALUES;

CREATE OR REPLACE FUNCTION public.verify_scheduler_token(_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT EXISTS (SELECT 1 FROM private.scheduler_token WHERE token = _token)
$$;
REVOKE ALL ON FUNCTION public.verify_scheduler_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_scheduler_token(text) TO service_role;