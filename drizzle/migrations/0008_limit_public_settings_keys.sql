DROP POLICY IF EXISTS "public read settings" ON public.app_settings;
CREATE POLICY "public read known settings" ON public.app_settings
FOR SELECT TO anon, authenticated
USING (key IN ('stamp_duty_pct','registration_pct','legal_fee_flat','whatsapp_number','contact_email','contact_phone','rera_agent_status'));