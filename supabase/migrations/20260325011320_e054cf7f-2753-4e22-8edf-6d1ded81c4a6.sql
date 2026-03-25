ALTER TABLE diagnosis_sessions
  ADD COLUMN IF NOT EXISTS confidence_score integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS confirmed_cause text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tests_summary jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS access_paths_used text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hardware_notes text[] DEFAULT '{}';