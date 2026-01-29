-- Migration: Fix attendance recorded_by foreign key constraint

DO $sql$
DECLARE
  has_attendance boolean := to_regclass('public.attendance') IS NOT NULL;
  has_recorded_by boolean := false;
BEGIN
  IF NOT has_attendance THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendance' AND column_name = 'recorded_by'
  ) INTO has_recorded_by;

  IF NOT has_recorded_by THEN
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS fk_attendance_recorded_by';
  EXECUTE 'ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_recorded_by_fkey';
  EXECUTE 'ALTER TABLE public.attendance ADD CONSTRAINT fk_attendance_recorded_by FOREIGN KEY (recorded_by) REFERENCES auth.users(id) ON DELETE CASCADE';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_attendance_recorded_by ON public.attendance(recorded_by)';
  EXECUTE 'COMMENT ON CONSTRAINT fk_attendance_recorded_by ON public.attendance IS ''References auth.users for the teacher/principal who recorded the attendance''';
END $sql$;
