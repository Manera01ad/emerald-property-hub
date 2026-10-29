-- Phase 1 W2-1. Localities are the single controlled list every new form selects from.
--
-- This file is NOT applied automatically. The repository owner runs it.
--
-- The table is built for the planned 400 km expansion: latitude and longitude let a
-- locality be added to the map without being shown, and `status` decides visibility.
-- Only status = 'active' rows are readable by the public, so adding the rest of the
-- region later needs no code change and no new policy.
--
-- Seed: the Chennai pilot. Tier 1 localities carry full evidence first; tier 2 follow.
-- No prices, demand or verification claims are stored here.

CREATE TABLE public.localities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  city text NOT NULL DEFAULT 'Chennai' CHECK (char_length(city) BETWEEN 1 AND 60),
  state text NOT NULL DEFAULT 'Tamil Nadu' CHECK (char_length(state) BETWEEN 1 AND 60),
  corridor text NOT NULL CHECK (char_length(corridor) BETWEEN 1 AND 80),
  tier smallint NOT NULL CHECK (tier BETWEEN 1 AND 3),
  status text NOT NULL DEFAULT 'hidden' CHECK (status IN ('hidden','active')),
  latitude numeric(9,6) CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude numeric(9,6) CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX localities_public_idx ON public.localities (status, city, tier, name);

GRANT SELECT ON public.localities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.localities TO authenticated;
GRANT ALL ON public.localities TO service_role;
ALTER TABLE public.localities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read active localities" ON public.localities FOR SELECT TO anon, authenticated
  USING (status = 'active');
CREATE POLICY "admins manage localities" ON public.localities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER localities_touch BEFORE UPDATE ON public.localities FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.localities (slug, name, city, corridor, tier, status, latitude, longitude) VALUES
  ('tambaram','Tambaram','Chennai','GST Road',1,'active',12.9249,80.1000),
  ('guduvancheri','Guduvancheri','Chennai','GST Road',1,'active',12.8450,80.0600),
  ('poonamallee','Poonamallee','Chennai','Poonamallee High Road',1,'active',13.0489,80.0946),
  ('potheri','Potheri','Chennai','GST Road',2,'active',12.8280,80.0450),
  ('maraimalai-nagar','Maraimalai Nagar','Chennai','GST Road',2,'active',12.7936,80.0262),
  ('avadi','Avadi','Chennai','Poonamallee–Avadi Road',2,'active',13.1067,80.0970),
  ('thiruverkkadu','Thiruverkkadu','Chennai','Poonamallee–Avadi Road',2,'active',13.0764,80.1224),
  ('pattabiram','Pattabiram','Chennai','Poonamallee–Avadi Road',2,'active',13.1200,80.0900)
ON CONFLICT (slug) DO NOTHING;
