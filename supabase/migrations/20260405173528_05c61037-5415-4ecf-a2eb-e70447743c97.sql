ALTER TABLE public.charm_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read charm cache"
ON public.charm_cache
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Service role can manage charm cache"
ON public.charm_cache
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);