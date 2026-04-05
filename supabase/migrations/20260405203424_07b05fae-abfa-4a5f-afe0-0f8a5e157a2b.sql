
-- Diagnostic patterns: cached successful diagnostic trees for reuse
CREATE TABLE public.diagnostic_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symptom_normalized TEXT NOT NULL,
  vehicle_make TEXT NOT NULL,
  vehicle_model TEXT NOT NULL,
  vehicle_year_min INTEGER,
  vehicle_year_max INTEGER,
  engine_family TEXT,
  confirmed_cause TEXT NOT NULL,
  diagnostic_tree JSONB NOT NULL DEFAULT '[]'::jsonb,
  steps_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  tools_used JSONB DEFAULT '[]'::jsonb,
  success_count INTEGER NOT NULL DEFAULT 1,
  failure_count INTEGER NOT NULL DEFAULT 0,
  confidence_score NUMERIC NOT NULL DEFAULT 0.5,
  avg_diagnostic_minutes INTEGER,
  source_diagnosis_id UUID REFERENCES public.diagnosis_sessions(id),
  source_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast pattern matching
CREATE INDEX idx_diagnostic_patterns_lookup 
  ON public.diagnostic_patterns (vehicle_make, vehicle_model, symptom_normalized);

-- RLS: patterns are globally readable, only service role can write
ALTER TABLE public.diagnostic_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read diagnostic patterns"
  ON public.diagnostic_patterns
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage diagnostic patterns"
  ON public.diagnostic_patterns
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
