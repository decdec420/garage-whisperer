CREATE TABLE public.diagnosis_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  chat_session_id uuid REFERENCES public.chat_sessions(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  symptom text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  conclusion text,
  conclusion_confidence integer,
  diagnosis_summary text,
  tree_data jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.diagnosis_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own diagnosis sessions"
  ON public.diagnosis_sessions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_diagnosis_sessions_vehicle ON public.diagnosis_sessions(vehicle_id);
CREATE INDEX idx_diagnosis_sessions_user ON public.diagnosis_sessions(user_id);