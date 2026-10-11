CREATE TABLE public.buyer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  intent text NOT NULL DEFAULT 'buy' CHECK (intent IN ('buy','rent')),
  property_types text[] NOT NULL DEFAULT '{}',
  budget numeric CHECK (budget IS NULL OR budget >= 0),
  monthly_rent_budget numeric CHECK (monthly_rent_budget IS NULL OR monthly_rent_budget >= 0),
  preferred_locations text[] NOT NULL DEFAULT '{}',
  bedrooms integer CHECK (bedrooms IS NULL OR bedrooms >= 0),
  min_area_sqft numeric CHECK (min_area_sqft IS NULL OR min_area_sqft >= 0),
  school_preference text,
  commute_destinations text[] NOT NULL DEFAULT '{}',
  lifestyle_priorities text[] NOT NULL DEFAULT '{}',
  financing text,
  move_in_timeframe text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buyer_profiles TO authenticated;
GRANT ALL ON public.buyer_profiles TO service_role;
ALTER TABLE public.buyer_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.buyer_profiles FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin read profiles" ON public.buyer_profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER buyer_profiles_touch BEFORE UPDATE ON public.buyer_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.buyer_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('buy','rent','rent_vs_buy')),
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.buyer_reports TO authenticated;
GRANT ALL ON public.buyer_reports TO service_role;
ALTER TABLE public.buyer_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reports read" ON public.buyer_reports FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own reports insert" ON public.buyer_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own reports delete" ON public.buyer_reports FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admin read reports" ON public.buyer_reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX buyer_reports_user_idx ON public.buyer_reports(user_id, created_at DESC);