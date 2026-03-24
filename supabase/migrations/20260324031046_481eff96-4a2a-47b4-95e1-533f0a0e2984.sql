
ALTER TABLE public.charm_cache
ADD COLUMN IF NOT EXISTS base_url text,
ADD COLUMN IF NOT EXISTS sub_pages_crawled text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS all_images jsonb DEFAULT '[]'::jsonb;
