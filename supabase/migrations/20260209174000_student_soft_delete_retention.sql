-- Student soft-delete retention (30 days)
-- Keeps deleted students recoverable for 30 days, then purges automatically.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID,
  ADD COLUMN IF NOT EXISTS delete_reason TEXT,
  ADD COLUMN IF NOT EXISTS permanent_delete_after TIMESTAMPTZ;

COMMENT ON COLUMN public.students.deleted_at IS
'Timestamp when the student was soft-deleted/deactivated.';
COMMENT ON COLUMN public.students.deleted_by IS
'Auth user id that performed the soft-delete/deactivation.';
COMMENT ON COLUMN public.students.delete_reason IS
'Reason captured when the student was deactivated.';
COMMENT ON COLUMN public.students.permanent_delete_after IS
'Timestamp after which a soft-deleted student can be permanently purged.';

CREATE INDEX IF NOT EXISTS idx_students_soft_delete_purge
  ON public.students (permanent_delete_after)
  WHERE is_active = false AND permanent_delete_after IS NOT NULL;

CREATE OR REPLACE FUNCTION public.deactivate_student(
  student_uuid UUID,
  reason TEXT DEFAULT 'left_school'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  affected_rows INTEGER;
  normalized_reason TEXT;
  retention_deadline TIMESTAMPTZ := NOW() + INTERVAL '30 days';
BEGIN
  normalized_reason := COALESCE(NULLIF(TRIM(reason), ''), 'left_school');

  UPDATE public.students
  SET
    is_active = false,
    status = 'inactive',
    class_id = NULL,
    deleted_at = COALESCE(deleted_at, NOW()),
    deleted_by = COALESCE(deleted_by, auth.uid()),
    delete_reason = normalized_reason,
    permanent_delete_after = COALESCE(permanent_delete_after, retention_deadline),
    notes = COALESCE(notes || E'\n\n', '') ||
      'Deactivated on ' || NOW()::DATE || ': ' || normalized_reason ||
      '. Scheduled for permanent deletion after ' || (retention_deadline AT TIME ZONE 'UTC')::DATE || '.',
    updated_at = NOW()
  WHERE id = student_uuid
    AND is_active = true;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  IF affected_rows = 0 THEN
    RAISE NOTICE 'Student % not found or already inactive', student_uuid;
    RETURN FALSE;
  END IF;

  -- Cancel any active lesson assignments
  UPDATE public.lesson_assignments
  SET status = 'cancelled'
  WHERE student_id = student_uuid
    AND status IN ('assigned', 'in_progress');

  -- Cancel any active homework assignments
  UPDATE public.homework_submissions
  SET status = 'cancelled'
  WHERE student_id = student_uuid
    AND status IN ('assigned', 'in_progress');

  RAISE NOTICE 'Student % successfully deactivated with retention until %', student_uuid, retention_deadline;
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.deactivate_student(UUID, TEXT) IS
'Deactivates a student and schedules permanent deletion 30 days later. Preserves data for recovery.';

GRANT EXECUTE ON FUNCTION public.deactivate_student(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.reactivate_student(
  student_uuid UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  UPDATE public.students
  SET
    is_active = true,
    status = 'active',
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL,
    permanent_delete_after = NULL,
    notes = COALESCE(notes || E'\n\n', '') || 'Reactivated on ' || NOW()::DATE || '. Scheduled deletion cleared.',
    updated_at = NOW()
  WHERE id = student_uuid
    AND is_active = false;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  IF affected_rows = 0 THEN
    RAISE NOTICE 'Student % not found or already active', student_uuid;
    RETURN FALSE;
  END IF;

  RAISE NOTICE 'Student % successfully reactivated', student_uuid;
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.reactivate_student(UUID) IS
'Reactivates a previously deactivated student and clears pending permanent deletion metadata.';

GRANT EXECUTE ON FUNCTION public.reactivate_student(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.purge_soft_deleted_students(
  p_limit INTEGER DEFAULT 200
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  target_ids UUID[];
  deleted_count INTEGER := 0;
BEGIN
  SELECT ARRAY_AGG(id)
  INTO target_ids
  FROM (
    SELECT s.id
    FROM public.students s
    WHERE s.is_active = false
      AND s.permanent_delete_after IS NOT NULL
      AND s.permanent_delete_after <= NOW()
    ORDER BY s.permanent_delete_after ASC
    LIMIT GREATEST(COALESCE(p_limit, 200), 1)
  ) due_students;

  IF target_ids IS NULL OR ARRAY_LENGTH(target_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  -- Clear references on NO ACTION constraints before deleting students.
  UPDATE public.registration_requests
  SET edudash_student_id = NULL
  WHERE edudash_student_id = ANY(target_ids);

  DELETE FROM public.aftercare_registrations
  WHERE student_id = ANY(target_ids);

  DELETE FROM public.students
  WHERE id = ANY(target_ids);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.purge_soft_deleted_students(INTEGER) IS
'Hard deletes soft-deleted students whose permanent_delete_after has passed. Intended for daily pg_cron use.';

REVOKE ALL ON FUNCTION public.purge_soft_deleted_students(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_soft_deleted_students(INTEGER) TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'purge_soft_deleted_students_daily';
    PERFORM cron.schedule(
      'purge_soft_deleted_students_daily',
      '20 2 * * *',
      'SELECT public.purge_soft_deleted_students(500)'
    );
    RAISE NOTICE 'pg_cron scheduled: purge_soft_deleted_students_daily';
  ELSE
    RAISE NOTICE 'pg_cron not enabled; purge_soft_deleted_students must be run manually.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule purge_soft_deleted_students_daily: %', SQLERRM;
END;
$$;
