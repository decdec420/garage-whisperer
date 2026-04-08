-- Security hardening for multi-user SaaS deployment.
-- 1) Actually enable RLS on legacy vehicle project tables.
-- 2) Remove direct authenticated access to shared cache/pattern tables.

ALTER TABLE public.vehicle_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_project_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read charm cache" ON public.charm_cache;
DROP POLICY IF EXISTS "Anyone authenticated can read diagnostic patterns" ON public.diagnostic_patterns;
