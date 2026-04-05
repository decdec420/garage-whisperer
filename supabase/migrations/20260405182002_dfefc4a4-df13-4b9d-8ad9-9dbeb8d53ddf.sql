
-- Table 1: diagnosis_feedback
CREATE TABLE diagnosis_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_session_id uuid REFERENCES diagnosis_sessions(id),
  project_id uuid REFERENCES projects(id),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  vehicle_id uuid REFERENCES vehicles(id),
  feedback_type text CHECK (feedback_type IN (
    'post_repair_fixed',
    'post_repair_not_fixed',
    'diagnosis_was_wrong',
    'diagnosis_was_right_skipped_repair',
    'resolved_externally'
  )),
  resolution_details text,
  is_repeat_of_session_id uuid REFERENCES diagnosis_sessions(id),
  repeat_type text CHECK (repeat_type IN (
    'same_root_cause',
    'related_failure',
    'new_problem'
  )),
  confirmed_cause_at_feedback text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE diagnosis_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own feedback" ON diagnosis_feedback
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Table 2: diagnosis_step_events
CREATE TABLE diagnosis_step_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_session_id uuid REFERENCES diagnosis_sessions(id),
  step_number integer NOT NULL,
  event_type text CHECK (event_type IN (
    'step_started',
    'step_passed',
    'step_failed',
    'step_skipped',
    'ratchet_opened',
    'photo_attached',
    'step_abandoned'
  )),
  time_on_step_seconds integer,
  confidence_at_event integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE diagnosis_step_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own step events" ON diagnosis_step_events
  FOR ALL USING (
    auth.uid() = (
      SELECT user_id FROM diagnosis_sessions WHERE id = diagnosis_session_id
    )
  )
  WITH CHECK (
    auth.uid() = (
      SELECT user_id FROM diagnosis_sessions WHERE id = diagnosis_session_id
    )
  );
