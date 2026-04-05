DROP POLICY IF EXISTS "Users can manage own feedback" ON diagnosis_feedback;
CREATE POLICY "Users can manage own feedback" ON diagnosis_feedback
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own step events" ON diagnosis_step_events;
CREATE POLICY "Users can manage own step events" ON diagnosis_step_events
  FOR ALL TO authenticated
  USING (auth.uid() = (SELECT user_id FROM diagnosis_sessions WHERE id = diagnosis_step_events.diagnosis_session_id))
  WITH CHECK (auth.uid() = (SELECT user_id FROM diagnosis_sessions WHERE id = diagnosis_step_events.diagnosis_session_id));