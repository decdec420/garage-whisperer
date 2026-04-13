
ALTER TABLE public.vehicle_documents
ADD COLUMN IF NOT EXISTS extracted_text text;
