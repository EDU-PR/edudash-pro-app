-- Fix RLS for student_fees so staff access works with auth_user_id
-- Date: 2026-01-27

DO $sql$
DECLARE
  staff_auth_pred text;
  staff_org_expr text;
  student_org_expr text;
BEGIN
  IF to_regclass('public.student_fees') IS NULL
     OR to_regclass('public.students') IS NULL
     OR to_regclass('public.profiles') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'auth_user_id'
  ) THEN
    staff_auth_pred := '(staff.auth_user_id = auth.uid() OR staff.id = auth.uid())';
  ELSE
    staff_auth_pred := 'staff.id = auth.uid()';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'organization_id'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'preschool_id'
  ) THEN
    staff_org_expr := 'COALESCE(staff.organization_id, staff.preschool_id)';
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'organization_id'
  ) THEN
    staff_org_expr := 'staff.organization_id';
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'preschool_id'
  ) THEN
    staff_org_expr := 'staff.preschool_id';
  ELSE
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
    student_org_expr := 'COALESCE(student.organization_id, student.preschool_id)';
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'students'
      AND column_name = 'organization_id'
  ) THEN
    student_org_expr := 'student.organization_id';
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'students'
      AND column_name = 'preschool_id'
  ) THEN
    student_org_expr := 'student.preschool_id';
  ELSE
    RETURN;
  END IF;

  EXECUTE format(
    $fmt$
    DROP POLICY IF EXISTS student_fees_staff_org ON public.student_fees;

    CREATE POLICY student_fees_staff_org ON public.student_fees
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.profiles staff
        JOIN public.students student ON student.id = student_fees.student_id
        WHERE %s
          AND staff.role = ANY (ARRAY['teacher'::text, 'admin'::text, 'principal'::text, 'principal_admin'::text, 'superadmin'::text, 'super_admin'::text])
          AND (
            staff.role IN ('superadmin'::text, 'super_admin'::text)
            OR %s = %s
          )
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.profiles staff
        JOIN public.students student ON student.id = student_fees.student_id
        WHERE %s
          AND staff.role = ANY (ARRAY['teacher'::text, 'admin'::text, 'principal'::text, 'principal_admin'::text, 'superadmin'::text, 'super_admin'::text])
          AND (
            staff.role IN ('superadmin'::text, 'super_admin'::text)
            OR %s = %s
          )
      )
    );
    $fmt$,
    staff_auth_pred,
    staff_org_expr,
    student_org_expr,
    staff_auth_pred,
    staff_org_expr,
    student_org_expr
  );
END $sql$;
