-- Store Dash AI tutor attempts for learner performance reporting

CREATE TABLE IF NOT EXISTS public.dash_ai_tutor_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  session_id TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('diagnostic', 'practice', 'quiz', 'explain')),
  subject TEXT,
  grade TEXT,
  topic TEXT,
  question TEXT,
  expected_answer TEXT,
  learner_answer TEXT,
  is_correct BOOLEAN,
  score DECIMAL(5,2),
  feedback TEXT,
  correct_answer TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dash_ai_tutor_attempts_user_id ON public.dash_ai_tutor_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_dash_ai_tutor_attempts_student_id ON public.dash_ai_tutor_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_dash_ai_tutor_attempts_session_id ON public.dash_ai_tutor_attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_dash_ai_tutor_attempts_created_at ON public.dash_ai_tutor_attempts(created_at DESC);

ALTER TABLE public.dash_ai_tutor_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tutor_attempts_select ON public.dash_ai_tutor_attempts;
CREATE POLICY tutor_attempts_select ON public.dash_ai_tutor_attempts
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR (
      student_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = dash_ai_tutor_attempts.student_id
          AND s.parent_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS tutor_attempts_insert ON public.dash_ai_tutor_attempts;
CREATE POLICY tutor_attempts_insert ON public.dash_ai_tutor_attempts
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR (
      student_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = dash_ai_tutor_attempts.student_id
          AND s.parent_id = auth.uid()
      )
    )
  );

GRANT SELECT, INSERT ON public.dash_ai_tutor_attempts TO authenticated;

COMMENT ON TABLE public.dash_ai_tutor_attempts IS 'Stores learner tutoring attempts from Dash AI for performance reporting.';
