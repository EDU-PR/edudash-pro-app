BEGIN;

CREATE TABLE IF NOT EXISTS public.name_practice_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  preschool_id uuid REFERENCES public.preschools(id) ON DELETE CASCADE,
  attempt_count integer NOT NULL DEFAULT 0,
  last_score numeric(5,2),
  best_score numeric(5,2),
  last_attempt_at timestamptz,
  latest_snapshot_url text,
  last_assignment_id uuid REFERENCES public.homework_assignments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT name_practice_progress_student_unique UNIQUE(student_id)
);

CREATE INDEX IF NOT EXISTS idx_name_practice_progress_preschool
  ON public.name_practice_progress(preschool_id);

CREATE INDEX IF NOT EXISTS idx_name_practice_progress_last_attempt
  ON public.name_practice_progress(last_attempt_at DESC);

ALTER TABLE public.name_practice_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS name_practice_parent_select ON public.name_practice_progress;
DROP POLICY IF EXISTS name_practice_parent_insert ON public.name_practice_progress;
DROP POLICY IF EXISTS name_practice_parent_update ON public.name_practice_progress;
DROP POLICY IF EXISTS name_practice_staff_select ON public.name_practice_progress;
DROP POLICY IF EXISTS name_practice_staff_update ON public.name_practice_progress;

CREATE POLICY name_practice_parent_select
  ON public.name_practice_progress
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id = name_practice_progress.student_id
        AND (s.parent_id = auth.uid() OR s.guardian_id = auth.uid())
    )
  );

CREATE POLICY name_practice_parent_insert
  ON public.name_practice_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id = name_practice_progress.student_id
        AND (s.parent_id = auth.uid() OR s.guardian_id = auth.uid())
    )
  );

CREATE POLICY name_practice_parent_update
  ON public.name_practice_progress
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id = name_practice_progress.student_id
        AND (s.parent_id = auth.uid() OR s.guardian_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id = name_practice_progress.student_id
        AND (s.parent_id = auth.uid() OR s.guardian_id = auth.uid())
    )
  );

CREATE POLICY name_practice_staff_select
  ON public.name_practice_progress
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('teacher', 'principal', 'admin', 'owner', 'superadmin')
        AND p.preschool_id = name_practice_progress.preschool_id
    )
  );

CREATE POLICY name_practice_staff_update
  ON public.name_practice_progress
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('teacher', 'principal', 'admin', 'owner', 'superadmin')
        AND p.preschool_id = name_practice_progress.preschool_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('teacher', 'principal', 'admin', 'owner', 'superadmin')
        AND p.preschool_id = name_practice_progress.preschool_id
    )
  );

DROP TRIGGER IF EXISTS trg_name_practice_progress_updated_at ON public.name_practice_progress;
CREATE TRIGGER trg_name_practice_progress_updated_at
  BEFORE UPDATE ON public.name_practice_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.record_name_practice_attempt(
  p_student_id uuid,
  p_preschool_id uuid,
  p_score numeric,
  p_snapshot_url text DEFAULT NULL,
  p_assignment_id uuid DEFAULT NULL
)
RETURNS public.name_practice_progress
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_parent_allowed boolean := false;
  v_staff_allowed boolean := false;
  v_row public.name_practice_progress;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = p_student_id
      AND (s.parent_id = v_actor OR s.guardian_id = v_actor)
  ) INTO v_parent_allowed;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_actor
      AND p.role IN ('teacher', 'principal', 'admin', 'owner', 'superadmin')
      AND p.preschool_id = p_preschool_id
  ) INTO v_staff_allowed;

  IF NOT v_parent_allowed AND NOT v_staff_allowed THEN
    RAISE EXCEPTION 'Permission denied for child %', p_student_id;
  END IF;

  INSERT INTO public.name_practice_progress (
    student_id,
    preschool_id,
    attempt_count,
    last_score,
    best_score,
    last_attempt_at,
    latest_snapshot_url,
    last_assignment_id
  )
  VALUES (
    p_student_id,
    p_preschool_id,
    1,
    p_score,
    p_score,
    now(),
    p_snapshot_url,
    p_assignment_id
  )
  ON CONFLICT (student_id)
  DO UPDATE SET
    preschool_id = COALESCE(EXCLUDED.preschool_id, name_practice_progress.preschool_id),
    attempt_count = name_practice_progress.attempt_count + 1,
    last_score = EXCLUDED.last_score,
    best_score = GREATEST(
      COALESCE(name_practice_progress.best_score, EXCLUDED.last_score),
      COALESCE(EXCLUDED.last_score, name_practice_progress.best_score)
    ),
    last_attempt_at = now(),
    latest_snapshot_url = COALESCE(EXCLUDED.latest_snapshot_url, name_practice_progress.latest_snapshot_url),
    last_assignment_id = COALESCE(EXCLUDED.last_assignment_id, name_practice_progress.last_assignment_id),
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_name_practice_attempt(uuid, uuid, numeric, text, uuid) TO authenticated;

COMMIT;
