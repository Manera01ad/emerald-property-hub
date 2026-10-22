DROP POLICY IF EXISTS "public read property photos" ON storage.objects;
CREATE POLICY "read photos of visible listings" ON storage.objects
FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'property-photos' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.properties p
      WHERE storage.objects.name = ANY (p.photos)
        AND p.status = 'published' AND p.listing_permission = true AND p.is_demo = false
    )
  )
);