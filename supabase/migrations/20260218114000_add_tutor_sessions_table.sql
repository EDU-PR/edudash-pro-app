-- Migration: Tutor session persistence for Dash Assistant/Orb
-- Purpose:
-- 1) Store resumable tutor session state as first-class records.
-- 2) Expose parent/teacher/principal org-scoped read visibility via RLS.
-- 3) Keep writes user-scoped from client; service-role writes remain allowed.

CREATE TABLE IF NOT EXISTS public.tutor_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  preschool_id UUID REFERENCES public.preschools(id) ON DELETE SET NULL,

  mode TEXT NOT NULL
    CHECK (mode IN ('diagnostic', 'practice', 'quiz', 'explain', 'play')),
  subject TEXT,
  grade TEXT,
  topic TEXT,
  difficulty INT NOT NULL DEFAULT 1 CHECK (difficulty >= 1 AND difficulty <= 5),

  questions_asked INT NOT NULL DEFAULT 0 CHECK (questions_asked >= 0),
  correct_count INT NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
  score NUMERIC(5, 2),

  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,

  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  curriculum_alignment JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tutor_sessions_user_started
  ON public.tutor_sessions (user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_tutor_sessions_student_started
  ON public.tutor_sessions (student_id, started_at DESC)
  WHERE student_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tutor_sessions_school_started
  ON public.tutor_sessions (preschool_id, started_at DESC)
  WHERE preschool_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tutor_sessions_active
  ON public.tutor_sessions (user_id, started_at DESC)
  WHERE ended_at IS NULL;

ALTER TABLE public.tutor_sessions ENABLE ROW LEVEL SECURITY;

-- User can always read own sessions
DROP POLICY IF EXISTS tutor_sessions_select_own ON public.tutor_sessions;
CREATE POLICY tutor_sessions_select_own
  ON public.tutor_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Parent linked to student can read child sessions
DROP POLICY IF EXISTS tutor_sessions_select_parent_child ON public.tutor_sessions;
CREATE POLICY tutor_sessions_select_parent_child
  ON public.tutor_sessions
  FOR SELECT
  USING (
    student_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id = tutor_sessions.student_id
        AND s.parent_id = auth.uid()
    )
  );

-- School staff can read sessions in their org
DROP POLICY IF EXISTS tutor_sessions_select_school_staff ON public.tutor_sessions;
CREATE POLICY tutor_sessions_select_school_staff
  ON public.tutor_sessions
  FOR SELECT
  USING (
    preschool_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('teacher', 'principal', 'principal_admin', 'admin', 'super_admin')
        AND COALESCE(p.organization_id, p.preschool_id) = tutor_sessions.preschool_id
    )
  );

-- Authenticated users can insert their own records
DROP POLICY IF EXISTS tutor_sessions_insert_own ON public.tutor_sessions;
CREATE POLICY tutor_sessions_insert_own
  ON public.tutor_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Authenticated users can update their own records
DROP POLICY IF EXISTS tutor_sessions_update_own ON public.tutor_sessions;
CREATE POLICY tutor_sessions_update_own
  ON public.tutor_sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Optional own-session delete
DROP POLICY IF EXISTS tutor_sessions_delete_own ON public.tutor_sessions;
CREATE POLICY tutor_sessions_delete_own
  ON public.tutor_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_tutor_sessions_updated_at ON public.tutor_sessions;
CREATE TRIGGER update_tutor_sessions_updated_at
  BEFORE UPDATE ON public.tutor_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutor_sessions TO authenticated;

COMMENT ON TABLE public.tutor_sessions IS
  'Resumable Dash tutor session snapshots used for continuity across app restarts and cross-device sync.';
