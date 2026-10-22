CREATE TABLE public.area_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  area text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  elevation_m numeric,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city, area)
);
GRANT SELECT ON public.area_intelligence TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.area_intelligence TO authenticated;
GRANT ALL ON public.area_intelligence TO service_role;
ALTER TABLE public.area_intelligence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read published area intelligence" ON public.area_intelligence FOR SELECT TO anon, authenticated USING (is_published = true);
CREATE POLICY "admins manage area intelligence" ON public.area_intelligence FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));