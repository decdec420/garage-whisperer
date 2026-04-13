
-- Table for manufacturer-recommended service intervals per vehicle
CREATE TABLE public.vehicle_service_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  interval_miles INTEGER,
  interval_months INTEGER,
  priority TEXT NOT NULL DEFAULT 'normal',
  category TEXT NOT NULL DEFAULT 'general',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(vehicle_id, service_name)
);

-- Enable RLS
ALTER TABLE public.vehicle_service_schedules ENABLE ROW LEVEL SECURITY;

-- Users can manage schedules for their own vehicles
CREATE POLICY "Users can CRUD own vehicle service schedules"
ON public.vehicle_service_schedules
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM vehicles WHERE vehicles.id = vehicle_service_schedules.vehicle_id AND vehicles.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM vehicles WHERE vehicles.id = vehicle_service_schedules.vehicle_id AND vehicles.user_id = auth.uid()
));

-- Index for fast lookups
CREATE INDEX idx_vehicle_service_schedules_vehicle_id ON public.vehicle_service_schedules(vehicle_id);
