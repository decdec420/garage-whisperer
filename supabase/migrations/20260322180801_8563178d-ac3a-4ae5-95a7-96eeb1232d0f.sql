
-- Projects table
CREATE TABLE public.vehicle_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  priority text DEFAULT 'medium',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Project tasks table
CREATE TABLE public.vehicle_project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.vehicle_projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo',
  estimated_cost numeric,
  actual_cost numeric,
  parts jsonb,
  notes text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS on vehicle_projects
CREATE POLICY "Users can CRUD own vehicle projects"
ON public.vehicle_projects FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM vehicles WHERE vehicles.id = vehicle_projects.vehicle_id AND vehicles.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM vehicles WHERE vehicles.id = vehicle_projects.vehicle_id AND vehicles.user_id = auth.uid()));

-- RLS on vehicle_project_tasks
CREATE POLICY "Users can CRUD own project tasks"
ON public.vehicle_project_tasks FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM vehicle_projects
  JOIN vehicles ON vehicles.id = vehicle_projects.vehicle_id
  WHERE vehicle_projects.id = vehicle_project_tasks.project_id AND vehicles.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM vehicle_projects
  JOIN vehicles ON vehicles.id = vehicle_projects.vehicle_id
  WHERE vehicle_projects.id = vehicle_project_tasks.project_id AND vehicles.user_id = auth.uid()
));
