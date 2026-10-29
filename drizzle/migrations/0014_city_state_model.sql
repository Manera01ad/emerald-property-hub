-- 0013: city and state model, additive only.
--
-- WHY: public.properties has one free-text `location` column and no city or
-- state. Chennai is hardcoded in src/lib/areas.ts, src/lib/nearme.ts,
-- src/lib/my-location.ts and src/lib/constants.ts. A second city cannot be added
-- without editing all of them, and area names can collide across cities.
--
-- SAFETY: every statement here is additive. `location` is kept, nothing is
-- renamed or dropped, and the public-visibility rule (status = 'published' AND
-- listing_permission AND NOT is_demo) is not touched, so no draft can leak
-- because of this migration.
--
-- The owner applies this. Agents do not run migrations.

-- 1. Additive columns on properties. Nullable, so existing rows stay valid.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS city  text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS area  text;

-- 2. Backfill from the existing free-text location. Chennai is the only launch
--    city, so every existing row is a Chennai row.
UPDATE public.properties
SET city = 'Chennai', state = 'Tamil Nadu', area = location
WHERE city IS NULL;

-- 3. Index the grouping keys the public pages will use.
CREATE INDEX IF NOT EXISTS properties_city_area_idx ON public.properties (city, area);

-- 4. Cities reference table. `is_active` is the rollout flag: a new city is
--    inserted with is_active = false, its data is loaded and reviewed, and only
--    then is it switched on. That gives a per-city kill switch without a deploy.
CREATE TABLE IF NOT EXISTS public.cities (
  slug        text PRIMARY KEY,
  name        text NOT NULL,
  state       text NOT NULL,
  is_active   boolean NOT NULL DEFAULT false,
  launched_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cities TO authenticated;
GRANT ALL ON public.cities TO service_role;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active cities" ON public.cities
  FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "admin all cities" ON public.cities
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.cities (slug, name, state, is_active, launched_at)
VALUES ('chennai', 'Chennai', 'Tamil Nadu', true, now())
ON CONFLICT (slug) DO NOTHING;

-- 5. Areas reference table, so a new area is a data change rather than a code
--    change and deploy. The TypeScript AREAS map stays as the seed and offline
--    fallback, so nothing breaks while this table is empty.
CREATE TABLE IF NOT EXISTS public.areas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_slug  text NOT NULL REFERENCES public.cities(slug) ON DELETE CASCADE,
  name       text NOT NULL,
  latitude   numeric NOT NULL,
  longitude  numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_slug, name)
);
GRANT SELECT ON public.areas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.areas TO authenticated;
GRANT ALL ON public.areas TO service_role;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read areas of active cities" ON public.areas
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.cities c WHERE c.slug = city_slug AND c.is_active = true));
CREATE POLICY "admin all areas" ON public.areas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. Seed the 45 Chennai areas from the current TypeScript map. These are the
--    same coordinates already used by the "near my area" filter, so behaviour is
--    unchanged. ON CONFLICT keeps this re-runnable.
INSERT INTO public.areas (city_slug, name, latitude, longitude) VALUES
  ('chennai','Adyar',13.0067,80.257),('chennai','Alandur',13.003,80.201),
  ('chennai','Ambattur',13.1143,80.1548),('chennai','Anna Nagar',13.085,80.2101),
  ('chennai','Ashok Nagar',13.0373,80.2123),('chennai','Avadi',13.1067,80.097),
  ('chennai','Besant Nagar',13.0002,80.2668),('chennai','Chromepet',12.9516,80.1462),
  ('chennai','Egmore',13.0732,80.2609),('chennai','Guduvancheri',12.845,80.06),
  ('chennai','Guindy',13.0067,80.2206),('chennai','KK Nagar',13.0415,80.199),
  ('chennai','Kelambakkam',12.787,80.225),('chennai','Kilpauk',13.0836,80.24),
  ('chennai','Koyambedu',13.0694,80.1948),('chennai','Madipakkam',12.9626,80.1986),
  ('chennai','Maraimalai Nagar',12.7936,80.0262),('chennai','Medavakkam',12.92,80.192),
  ('chennai','Mogappair',13.085,80.175),('chennai','Mylapore',13.0368,80.2676),
  ('chennai','Navalur',12.8456,80.2265),('chennai','Nungambakkam',13.0569,80.2425),
  ('chennai','Pallavaram',12.9675,80.1491),('chennai','Pallikaranai',12.934,80.214),
  ('chennai','Pammal',12.968,80.135),('chennai','Pattabiram',13.123,80.063),
  ('chennai','Perambur',13.118,80.24),('chennai','Perungudi',12.965,80.2461),
  ('chennai','Poonamallee',13.0473,80.0945),('chennai','Porur',13.0382,80.1565),
  ('chennai','Potheri',12.8231,80.0442),('chennai','Saidapet',13.0213,80.2231),
  ('chennai','Selaiyur',12.906,80.14),('chennai','Sholinganallur',12.901,80.2279),
  ('chennai','Siruseri',12.824,80.225),('chennai','T. Nagar',13.0418,80.2341),
  ('chennai','Tambaram',12.9249,80.1),('chennai','Taramani',12.9863,80.242),
  ('chennai','Thiruvanmiyur',12.983,80.2594),('chennai','Thiruverkkadu',13.0764,80.1224),
  ('chennai','Thoraipakkam',12.941,80.236),('chennai','Urapakkam',12.868,80.075),
  ('chennai','Vadapalani',13.05,80.2121),('chennai','Vandalur',12.8923,80.081),
  ('chennai','Velachery',12.9815,80.218)
ON CONFLICT (city_slug, name) DO NOTHING;

-- 7. Scope research sources to a city, so one city's feeds cannot flood another
--    city's review queue. NULL keeps current behaviour for every existing row.
ALTER TABLE public.research_sources
  ADD COLUMN IF NOT EXISTS city_slug text REFERENCES public.cities(slug);
