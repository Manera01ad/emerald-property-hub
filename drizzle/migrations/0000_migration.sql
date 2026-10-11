
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.handle_first_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created_admin AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_first_admin();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'developer' CHECK (kind IN ('developer','agent','owner')),
  phone text, email text, rera_number text, notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partners TO authenticated;
GRANT ALL ON public.partners TO service_role;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all partners" ON public.partners FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  property_type text NOT NULL CHECK (property_type IN ('villa','independent_house','resale_home','apartment','plot')),
  location text NOT NULL,
  address text,
  asking_price numeric NOT NULL CHECK (asking_price >= 0),
  bedrooms int,
  built_area_sqft numeric,
  land_area_sqft numeric,
  approvals text[] NOT NULL DEFAULT '{}',
  availability text NOT NULL DEFAULT 'ready' CHECK (availability IN ('ready','under_construction','sold')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  is_demo boolean NOT NULL DEFAULT false,
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified','partially_verified','verified')),
  verification_evidence text,
  listing_permission boolean NOT NULL DEFAULT false,
  permission_evidence text,
  source text,
  rera_number text,
  description text,
  amenities text[] NOT NULL DEFAULT '{}',
  photos text[] NOT NULL DEFAULT '{}',
  doc_title_deed boolean NOT NULL DEFAULT false,
  doc_encumbrance boolean NOT NULL DEFAULT false,
  doc_patta boolean NOT NULL DEFAULT false,
  doc_approved_plan boolean NOT NULL DEFAULT false,
  doc_building_permit boolean NOT NULL DEFAULT false,
  guideline_value numeric,
  latitude numeric, longitude numeric,
  partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.properties TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read published" ON public.properties FOR SELECT TO anon, authenticated
  USING (status = 'published' AND is_demo = false AND listing_permission = true);
CREATE POLICY "admin all properties" ON public.properties FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER properties_touch BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.nearby_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('cbse_school','hospital','transport','employment')),
  name text NOT NULL,
  distance_km numeric,
  source text,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.nearby_places TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nearby_places TO authenticated;
GRANT ALL ON public.nearby_places TO service_role;
ALTER TABLE public.nearby_places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read places of published" ON public.nearby_places FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.status='published' AND p.is_demo=false AND p.listing_permission=true));
CREATE POLICY "admin all places" ON public.nearby_places FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.infrastructure_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text NOT NULL,
  description text,
  progress_status text NOT NULL DEFAULT 'announced' CHECK (progress_status IN ('announced','approved','under_construction','completed','stalled')),
  source_url text,
  verified boolean NOT NULL DEFAULT false,
  last_checked date,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.infrastructure_projects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.infrastructure_projects TO authenticated;
GRANT ALL ON public.infrastructure_projects TO service_role;
ALTER TABLE public.infrastructure_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read infra" ON public.infrastructure_projects FOR SELECT TO anon, authenticated USING (is_published = true);
CREATE POLICY "admin all infra" ON public.infrastructure_projects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_type text NOT NULL CHECK (enquiry_type IN ('consultation','site_visit')),
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  phone text NOT NULL CHECK (char_length(phone) BETWEEN 6 AND 20),
  email text CHECK (email IS NULL OR char_length(email) <= 200),
  budget numeric,
  preferred_locations text[] NOT NULL DEFAULT '{}',
  property_types text[] NOT NULL DEFAULT '{}',
  bedrooms int,
  preferred_visit_date date,
  message text CHECK (message IS NULL OR char_length(message) <= 2000),
  consent boolean NOT NULL CHECK (consent = true),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','follow_up','visit_scheduled','visited','negotiation','won','lost')),
  next_follow_up date,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.enquiries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enquiries TO authenticated;
GRANT ALL ON public.enquiries TO service_role;
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone submit enquiry" ON public.enquiries FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'new' AND admin_notes IS NULL);
CREATE POLICY "admin all enquiries" ON public.enquiries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER enquiries_touch BEFORE UPDATE ON public.enquiries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  enquiry_id uuid REFERENCES public.enquiries(id) ON DELETE SET NULL,
  agreement_terms text,
  commission_pct numeric,
  expected_amount numeric NOT NULL DEFAULT 0,
  invoice_number text,
  invoice_date date,
  paid_amount numeric NOT NULL DEFAULT 0,
  paid_date date,
  status text NOT NULL DEFAULT 'agreed' CHECK (status IN ('agreed','invoiced','partially_paid','paid','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commissions TO authenticated;
GRANT ALL ON public.commissions TO service_role;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all commissions" ON public.commissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  label text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read settings" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin write settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.app_settings (key, value, label) VALUES
  ('stamp_duty_pct','7','Stamp duty (% of higher of price or guideline value)'),
  ('registration_pct','2','Registration fee (% of higher of price or guideline value)'),
  ('legal_fee_flat','15000','Estimated legal & documentation fee (₹)'),
  ('whatsapp_number','','WhatsApp number with country code, digits only (e.g. 919876543210)'),
  ('contact_email','','Public contact email'),
  ('contact_phone','','Public contact phone');

CREATE POLICY "public read property photos" ON storage.objects FOR SELECT USING (bucket_id = 'property-photos');
CREATE POLICY "admin upload property photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'property-photos' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete property photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'property-photos' AND public.has_role(auth.uid(),'admin'));

INSERT INTO public.properties (title, property_type, location, asking_price, bedrooms, built_area_sqft, land_area_sqft, approvals, availability, status, is_demo, verification_status, source, description, amenities, guideline_value)
VALUES
 ('[DEMO] 3BHK Villa near GST Road','villa','Guduvancheri',8500000,3,1650,1200,ARRAY['DTCP'],'ready','published',true,'unverified','Demo record for testing','Demo listing for testing only. Not a real property.',ARRAY['Car parking','Gated community'],7200000),
 ('[DEMO] 2BHK Apartment','apartment','Potheri',5200000,2,1050,NULL,ARRAY['CMDA','RERA'],'under_construction','published',true,'unverified','Demo record for testing','Demo listing for testing only. Not a real property.',ARRAY['Lift','Power backup'],4500000),
 ('[DEMO] Residential Plot 1200 sq ft','plot','Tambaram',3600000,NULL,NULL,1200,ARRAY['DTCP'],'ready','published',true,'unverified','Demo record for testing','Demo listing for testing only. Not a real property.',ARRAY[]::text[],3000000);
