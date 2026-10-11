CREATE TABLE public.research_ticks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin text NOT NULL CHECK (origin IN ('pg_cron','manual_endpoint')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  agents jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text
);
GRANT SELECT ON public.research_ticks TO authenticated;
GRANT ALL ON public.research_ticks TO service_role;
ALTER TABLE public.research_ticks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read ticks" ON public.research_ticks FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));

ALTER TABLE public.research_runs ADD COLUMN tick_id uuid REFERENCES public.research_ticks(id) ON DELETE SET NULL;

ALTER TABLE public.research_sources DROP CONSTRAINT research_sources_access_method_check;
ALTER TABLE public.research_sources ADD CONSTRAINT research_sources_access_method_check CHECK (access_method IN ('json_feed','fixture','google_places','manual','csv_upload'));
ALTER TABLE public.research_sources ADD COLUMN field_mapping jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.research_sources ADD COLUMN source_identity text;
ALTER TABLE public.research_sources ADD COLUMN api_docs_url text;

ALTER TABLE public.infrastructure_projects ADD COLUMN document_url text;
ALTER TABLE public.infrastructure_projects ADD COLUMN extracted_facts jsonb;
ALTER TABLE public.infrastructure_projects ADD COLUMN extracted_at timestamptz;

INSERT INTO public.research_sources (name, kind, url, access_method, permission_status, enabled, can_publish, refresh_hours, rate_limit_per_run, permitted_usage, notes) VALUES
('CMDA Chennai (official)', 'government', 'https://www.cmdachennai.gov.in/', 'manual', 'pending', false, false, 168, 20,
 'Copyright statement allows accurate reproduction with prominent source acknowledgement (cmdachennai.gov.in/copyright.htm). Framing not allowed (hyperlink policy).',
 'Reviewed Oct 2026: no public API, RSS or data feed found. Automated access is not addressed in site policies. Not reachable from our servers during review. Keep disabled until CMDA confirms automated access or a structured feed is available.'),
('Tamil Nadu Government Gazette (Stationery & Printing)', 'government', 'https://stationeryprinting.tn.gov.in/', 'manual', 'pending', false, false, 168, 20,
 null,
 'Reviewed Oct 2026: gazette notifications published as PDF documents; no API or feed found; automated-access terms not found. Not reachable from our servers during review. Requires permission review.'),
('CUMTA (official)', 'government', 'https://cumta.tn.gov.in/', 'manual', 'pending', false, false, 168, 20,
 null,
 'Reviewed Oct 2026: no API or feed found; terms for automated access not found. Not reachable from our servers during review. Requires permission review.'),
('TNRERA (official)', 'government', 'https://rera.tn.gov.in/', 'manual', 'pending', false, false, 168, 20,
 'Copyright policy permits reproduction of TNRERA material except third-party content (rera.tn.gov.in/policies/copyright). Project registrations are regulatory records only and are never treated as permission to list or republish commercial property.',
 'Reviewed Oct 2026: no public API or feed; project search is an interactive form. Automated access not addressed. Not reachable from our servers during review. Requires permission review.');