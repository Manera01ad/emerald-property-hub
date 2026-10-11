CREATE TABLE public.site_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id uuid REFERENCES public.enquiries(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  visit_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_visits TO authenticated;
GRANT ALL ON public.site_visits TO service_role;
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all visits" ON public.site_visits FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER site_visits_touch BEFORE UPDATE ON public.site_visits FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.enquiries ADD COLUMN assigned_consultant text;
ALTER TABLE public.partners ADD COLUMN agreement_status text NOT NULL DEFAULT 'none';
ALTER TABLE public.commissions ADD COLUMN fixed_amount numeric;
ALTER TABLE public.commissions ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER commissions_touch BEFORE UPDATE ON public.commissions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP POLICY "anyone submit enquiry" ON public.enquiries;
CREATE POLICY "anyone submit enquiry" ON public.enquiries FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'new' AND admin_notes IS NULL AND assigned_consultant IS NULL AND consent = true);