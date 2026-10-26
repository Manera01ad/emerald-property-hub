-- Every lookup the assistant makes on a user's behalf, so the user can see exactly what was searched.
-- Written by the assistant route while acting as the signed-in user (row-level security applies).
-- Web lookups use a licensed search API only; nothing here is scraped.
CREATE TABLE public.assistant_search_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  message_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('listings', 'listing', 'web')),
  query jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_count integer NOT NULL DEFAULT 0,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assistant_search_log_user_created ON public.assistant_search_log (user_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.assistant_search_log TO authenticated;
GRANT ALL ON public.assistant_search_log TO service_role;
ALTER TABLE public.assistant_search_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own search log read" ON public.assistant_search_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own search log insert" ON public.assistant_search_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own search log delete" ON public.assistant_search_log FOR DELETE TO authenticated USING (auth.uid() = user_id);
