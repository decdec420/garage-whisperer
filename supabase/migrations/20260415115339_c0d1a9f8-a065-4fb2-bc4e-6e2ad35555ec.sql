
CREATE TABLE public.obd_scan_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  scanner_name TEXT,
  pids_captured JSONB DEFAULT '[]'::jsonb,
  dtcs_found JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.obd_scan_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own scan sessions"
  ON public.obd_scan_sessions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
