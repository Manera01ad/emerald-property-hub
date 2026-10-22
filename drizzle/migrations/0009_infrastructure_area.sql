-- Link infrastructure projects to a named area, so a buyer can see what is
-- planned near a home rather than reading a flat list.
--
-- The area is a plain nullable column. The existing free-text `location` stays
-- as it is, so nothing that reads it breaks and no row is invalidated.
--
-- No new policy is needed: the existing "public read infra" policy already
-- restricts anonymous and authenticated reads to is_published = true, and it
-- covers every column including this one.

ALTER TABLE public.infrastructure_projects
  ADD COLUMN IF NOT EXISTS area text;

-- Index the grouping key used by the public page.
CREATE INDEX IF NOT EXISTS infrastructure_projects_area_idx
  ON public.infrastructure_projects (area);

-- Backfill rows whose free-text location already names a known area.
-- Only exact matches to the area list are linked; anything else is left null
-- and shows under "Other areas" until an admin sets it.
UPDATE public.infrastructure_projects
SET area = location
WHERE area IS NULL
  AND location IN (
    'Adyar','Alandur','Ambattur','Anna Nagar','Ashok Nagar','Avadi','Besant Nagar',
    'Chromepet','Egmore','Guduvancheri','Guindy','KK Nagar','Kelambakkam','Kilpauk',
    'Koyambedu','Madipakkam','Maraimalai Nagar','Medavakkam','Mogappair','Mylapore',
    'Navalur','Nungambakkam','Pallavaram','Pallikaranai','Pammal','Pattabiram',
    'Perambur','Perungudi','Poonamallee','Porur','Potheri','Saidapet','Selaiyur',
    'Sholinganallur','Siruseri','T. Nagar','Tambaram','Taramani','Thiruvanmiyur',
    'Thiruverkkadu','Thoraipakkam','Urapakkam','Vadapalani','Vandalur','Velachery'
  );

-- Seed Chennai Metro Phase 2, from public records only.
-- Rows land unpublished and unverified on purpose: an admin reviews each one
-- and publishes it. Nothing here reaches the public site until that happens.
-- Guarded by name so re-running the migration cannot create duplicates.
INSERT INTO public.infrastructure_projects
  (name, location, area, description, progress_status, source_url, verified, last_checked, is_published)
SELECT v.name, v.location, v.area, v.description, v.progress_status, v.source_url,
       false, DATE '2026-10-16', false
FROM (VALUES
  (
    'Chennai Metro Phase 2 — Poonamallee Bypass to Vadapalani',
    'Poonamallee',
    'Poonamallee',
    'Yellow Line (Corridor 4) elevated stretch, about 14.6 km with 11 stations. Opened to the public on 11 October 2026. Interchange with Corridor 5 is planned at Poonamallee.',
    'completed',
    'https://en.wikipedia.org/wiki/Yellow_Line_(Chennai_Metro)'
  ),
  (
    'Chennai Metro Phase 2 — Vadapalani to Panagal Park',
    'Vadapalani',
    'Vadapalani',
    'Underground continuation of the Yellow Line, about 3.5 km. Tunnelling is complete; reported target is March 2027.',
    'under_construction',
    'https://en.wikipedia.org/wiki/Yellow_Line_(Chennai_Metro)'
  ),
  (
    'Chennai Metro Phase 2 — Porur Junction to Kodambakkam',
    'Porur',
    'Porur',
    'Section of the Yellow Line between Porur Junction and Kodambakkam. Civil works and track laying reported in progress.',
    'under_construction',
    'https://en.wikipedia.org/wiki/Yellow_Line_(Chennai_Metro)'
  ),
  (
    'Chennai Metro Phase 2 extension — Poonamallee to Sunguvarchatram',
    'Poonamallee',
    'Poonamallee',
    'Proposed 27.9 km extension of the Yellow Line with 14 stations, running west towards Sunguvarchatram. Detailed project report approved by the state.',
    'approved',
    'https://en.wikipedia.org/wiki/Yellow_Line_(Chennai_Metro)'
  )
) AS v(name, location, area, description, progress_status, source_url)
WHERE NOT EXISTS (
  SELECT 1 FROM public.infrastructure_projects p WHERE p.name = v.name
);
