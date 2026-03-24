-- Make both buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('repair-photos', 'vehicle-documents');

-- Tighten read policies to scope by user_id path prefix
DROP POLICY IF EXISTS "Users can view repair photos" ON storage.objects;
CREATE POLICY "Users can view repair photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'repair-photos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can view vehicle documents" ON storage.objects;
CREATE POLICY "Users can view vehicle documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'vehicle-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);