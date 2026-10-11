ALTER TABLE public.enquiries DROP CONSTRAINT enquiries_status_check;
UPDATE public.enquiries SET status = CASE status WHEN 'follow_up' THEN 'contacted' WHEN 'visit_scheduled' THEN 'site_visit' WHEN 'visited' THEN 'site_visit' ELSE status END;
ALTER TABLE public.enquiries ADD CONSTRAINT enquiries_status_check CHECK (status IN ('new','contacted','qualified','site_visit','negotiation','won','lost'));