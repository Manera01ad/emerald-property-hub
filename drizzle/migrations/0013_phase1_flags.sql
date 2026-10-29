-- Phase 1 flags (W1-3). Adds the three feature flags to app_settings and widens
-- the public-read policy so the browser can read them.
--
-- This file is NOT applied automatically. The repository owner runs it.
--
-- Widening the policy to named flag keys keeps the 0008 rule intact: only keys
-- on this list are readable by anon. Nothing else becomes public.

INSERT INTO public.app_settings (key, value, label) VALUES
  ('feature_community','off','Feature flag: community threads and posts (on/off)'),
  ('feature_owner_submissions','off','Feature flag: owner listing submissions (on/off)'),
  ('feature_interest_requests','off','Feature flag: interest requests on approved listings (on/off)')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "public read known settings" ON public.app_settings;
CREATE POLICY "public read known settings" ON public.app_settings
FOR SELECT TO anon, authenticated
USING (key IN (
  'stamp_duty_pct','registration_pct','legal_fee_flat',
  'whatsapp_number','contact_email','contact_phone','rera_agent_status',
  'feature_community','feature_owner_submissions','feature_interest_requests'
));
