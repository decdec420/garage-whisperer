ALTER TABLE public.diagnosis_sessions 
ADD COLUMN IF NOT EXISTS media_urls jsonb DEFAULT '[]'::jsonb;