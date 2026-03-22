-- Table for vehicle documents, manuals, photos, and reference links
CREATE TABLE public.vehicle_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  doc_type text NOT NULL DEFAULT 'manual',
  file_url text,
  external_url text,
  file_size integer,
  mime_type text,
  thumbnail_url text,
  source text DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicle_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own vehicle documents"
  ON public.vehicle_documents
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('vehicle-documents', 'vehicle-documents', true, 10485760)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload vehicle documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'vehicle-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view vehicle documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'vehicle-documents');

CREATE POLICY "Users can delete own vehicle documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'vehicle-documents' AND (storage.foldername(name))[1] = auth.uid()::text);