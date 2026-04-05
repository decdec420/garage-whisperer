CREATE POLICY "Users can update own repair photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'repair-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own vehicle documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'vehicle-documents' AND (storage.foldername(name))[1] = auth.uid()::text);