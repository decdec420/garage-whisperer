
CREATE TABLE public.ratchet_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE,
  memory_type text NOT NULL,
  content text NOT NULL,
  source_session_id uuid REFERENCES public.chat_sessions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ratchet_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own memories"
  ON public.ratchet_memory
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_ratchet_memory_user ON public.ratchet_memory(user_id);
CREATE INDEX idx_ratchet_memory_vehicle ON public.ratchet_memory(vehicle_id);
