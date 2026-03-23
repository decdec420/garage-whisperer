
-- charm_cache: shared cache for charm.li data, no RLS needed
CREATE TABLE public.charm_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charm_url text UNIQUE NOT NULL,
  images text[] DEFAULT '{}',
  procedure_text text,
  torque_specs jsonb DEFAULT '[]',
  fetched_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Disable RLS since this is shared public data
ALTER TABLE public.charm_cache DISABLE ROW LEVEL SECURITY;

-- Add charm fields to project_steps
ALTER TABLE public.project_steps
  ADD COLUMN IF NOT EXISTS charm_image_url text,
  ADD COLUMN IF NOT EXISTS charm_source_url text,
  ADD COLUMN IF NOT EXISTS is_factory_verified boolean DEFAULT false;
