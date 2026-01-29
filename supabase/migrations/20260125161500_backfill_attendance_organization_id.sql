-- Backfill attendance organization_id using the linked student record.
-- This keeps attendance analytics scoped to the correct organization.

DO $sql$
DECLARE
  student_org_expr text;
BEGIN
  IF to_regclass('public.attendance') IS NULL OR to_regclass('public.students') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'attendance'
      AND column_name = 'student_id'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'attendance'
      AND column_name = 'organization_id'
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'students'
      AND column_name = 'organization_id'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'students'
      AND column_name = 'preschool_id'
  ) THEN
    student_org_expr := 'COALESCE(s.organization_id, s.preschool_id)';
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'students'
      AND column_name = 'organization_id'
  ) THEN
    student_org_expr := 's.organization_id';
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'students'
      AND column_name = 'preschool_id'
  ) THEN
    student_org_expr := 's.preschool_id';
  ELSE
    RETURN;
  END IF;

  EXECUTE format(
    'UPDATE public.attendance AS a
     SET organization_id = %s
     FROM public.students AS s
     WHERE a.student_id = s.id
       AND a.organization_id IS NULL
       AND %s IS NOT NULL;',
    student_org_expr,
    student_org_expr
  );
END $sql$;
