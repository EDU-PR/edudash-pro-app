-- Migration: Teacher access to tutor attempt analytics
-- Purpose: Add RLS policies for teachers/principals to read tutor attempt data
--          for students in their classes, plus an RPC for aggregated class analytics.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Add 'play' to the mode CHECK constraint (Preschool play mode from Module 2)
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.dash_ai_tutor_attempts
  DROP CONSTRAINT IF EXISTS dash_ai_tutor_attempts_mode_check;

ALTER TABLE public.dash_ai_tutor_attempts
  ADD CONSTRAINT dash_ai_tutor_attempts_mode_check
  CHECK (mode IN ('diagnostic', 'practice', 'quiz', 'explain', 'play'));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. RLS policy: teachers can read attempts by students in their classes
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS tutor_attempts_teacher_select ON public.dash_ai_tutor_attempts;

CREATE POLICY tutor_attempts_teacher_select ON public.dash_ai_tutor_attempts
  FOR SELECT
  USING (
    student_id IS NOT NULL
    AND EXISTS (
      SELECT 1
        FROM public.students s
        JOIN public.classes c ON c.id = s.class_id
       WHERE s.id = dash_ai_tutor_attempts.student_id
         AND c.teacher_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. RLS policy: principals can read all attempts in their school
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS tutor_attempts_principal_select ON public.dash_ai_tutor_attempts;

CREATE POLICY tutor_attempts_principal_select ON public.dash_ai_tutor_attempts
  FOR SELECT
  USING (
    student_id IS NOT NULL
    AND EXISTS (
      SELECT 1
        FROM public.students s
        JOIN public.profiles p ON p.id = auth.uid()
       WHERE s.id = dash_ai_tutor_attempts.student_id
         AND s.preschool_id = p.organization_id
         AND p.role = 'principal'
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Composite index for the teacher join path (performance)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_tutor_attempts_student_correct
  ON public.dash_ai_tutor_attempts (student_id, is_correct, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tutor_attempts_subject_grade
  ON public.dash_ai_tutor_attempts (subject, grade, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. RPC: Aggregated class tutor analytics for teacher heatmap
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_class_tutor_analytics(
  p_class_id UUID,
  p_since TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days')
)
RETURNS TABLE (
  student_id       UUID,
  student_name     TEXT,
  subject          TEXT,
  total_attempts   BIGINT,
  correct_count    BIGINT,
  accuracy_pct     NUMERIC(5, 1),
  avg_score        NUMERIC(5, 1),
  last_attempt_at  TIMESTAMPTZ,
  session_count    BIGINT,
  modes_used       TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
BEGIN
  -- Security: verify caller is the class teacher or a principal in the same org
  IF NOT EXISTS (
    SELECT 1
      FROM public.classes c
     WHERE c.id = p_class_id
       AND (
         c.teacher_id = auth.uid()
         OR EXISTS (
           SELECT 1
             FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'principal'
              AND p.organization_id = c.preschool_id
         )
       )
  ) THEN
    RAISE EXCEPTION 'Access denied: you are not the teacher of this class';
  END IF;

  RETURN QUERY
  SELECT
    s.id                                                  AS student_id,
    CONCAT(s.first_name, ' ', s.last_name)                AS student_name,
    COALESCE(a.subject, 'Unknown')                        AS subject,
    COUNT(*)                                              AS total_attempts,
    COUNT(*) FILTER (WHERE a.is_correct = TRUE)           AS correct_count,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE a.is_correct = TRUE) /
      NULLIF(COUNT(*), 0), 1
    )                                                     AS accuracy_pct,
    ROUND(AVG(a.score), 1)                                AS avg_score,
    MAX(a.created_at)                                     AS last_attempt_at,
    COUNT(DISTINCT a.session_id)                          AS session_count,
    ARRAY_AGG(DISTINCT a.mode)                            AS modes_used
  FROM public.students s
  JOIN public.dash_ai_tutor_attempts a ON a.student_id = s.id
  WHERE s.class_id = p_class_id
    AND a.created_at >= p_since
  GROUP BY s.id, s.first_name, s.last_name, a.subject
  ORDER BY s.first_name, s.last_name, a.subject;
END;
$$;

COMMENT ON FUNCTION public.get_class_tutor_analytics IS
  'Returns per-student, per-subject tutor analytics for a class. Used by teacher heatmap dashboard.';

-- Grant execute to authenticated users (RPC enforces its own auth check)
GRANT EXECUTE ON FUNCTION public.get_class_tutor_analytics(UUID, TIMESTAMPTZ) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. RPC: Student detail drilldown (individual tutor session history)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_student_tutor_sessions(
  p_student_id UUID,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  session_id       TEXT,
  mode             TEXT,
  subject          TEXT,
  grade            TEXT,
  topic            TEXT,
  total_questions  BIGINT,
  correct_answers  BIGINT,
  accuracy_pct     NUMERIC(5, 1),
  started_at       TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
BEGIN
  -- Security: caller must be the student's teacher, parent, or principal
  IF NOT EXISTS (
    SELECT 1 FROM public.students s
    LEFT JOIN public.classes c ON c.id = s.class_id
    LEFT JOIN public.profiles p ON p.id = auth.uid()
    WHERE s.id = p_student_id
      AND (
        c.teacher_id = auth.uid()
        OR s.parent_id = auth.uid()
        OR auth.uid() = ANY(s.parent_ids)
        OR (p.role = 'principal' AND p.organization_id = s.preschool_id)
      )
  ) THEN
    RAISE EXCEPTION 'Access denied: not authorized to view this student';
  END IF;

  RETURN QUERY
  SELECT
    a.session_id,
    MAX(a.mode)                                           AS mode,
    MAX(a.subject)                                        AS subject,
    MAX(a.grade)                                          AS grade,
    MAX(a.topic)                                          AS topic,
    COUNT(*)                                              AS total_questions,
    COUNT(*) FILTER (WHERE a.is_correct = TRUE)           AS correct_answers,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE a.is_correct = TRUE) /
      NULLIF(COUNT(*), 0), 1
    )                                                     AS accuracy_pct,
    MIN(a.created_at)                                     AS started_at,
    MAX(a.created_at)                                     AS ended_at
  FROM public.dash_ai_tutor_attempts a
  WHERE a.student_id = p_student_id
    AND a.session_id IS NOT NULL
  GROUP BY a.session_id
  ORDER BY MIN(a.created_at) DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.get_student_tutor_sessions IS
  'Returns tutor session summaries for a student. Used for drilldown from class heatmap.';

GRANT EXECUTE ON FUNCTION public.get_student_tutor_sessions(UUID, INT) TO authenticated;
