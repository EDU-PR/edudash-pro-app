-- Fix pop_uploads parent insert policy so parents can upload POPs for uniforms
-- and other fees reliably.
--
-- Previous policy:
-- - Matched students by parent/guardian BUT required s.is_active = true
--   which blocks uploads for archived/inactive learners (still paying arrears).
-- - For staff (teachers/admin/principals) it compared preschool_id only
--   against profiles.organization_id, which fails for profiles that use
--   preschool_id instead.
--
-- This migration:
-- - Drops and recreates "pop_uploads_parent_insert"
-- - Keeps the core intent (only parents/guardians of the child OR school staff)
--   but:
--   * Removes the s.is_active check so arrears / legacy POPs are allowed
--   * Uses COALESCE(organization_id, preschool_id) for staff tenant match

DO $do$
BEGIN
  IF to_regclass('public.pop_uploads') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pop_uploads'
      AND policyname = 'pop_uploads_parent_insert'
  ) THEN
    DROP POLICY "pop_uploads_parent_insert" ON public.pop_uploads;
  END IF;

  CREATE POLICY "pop_uploads_parent_insert"
  ON public.pop_uploads
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1
        FROM public.students s
        WHERE s.id = pop_uploads.student_id
          AND (s.parent_id = auth.uid() OR s.guardian_id = auth.uid())
      )
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text, 'principal'::text, 'principal_admin'::text])
          AND COALESCE(p.organization_id, p.preschool_id) = pop_uploads.preschool_id
      )
    )
  );
END;
$do$;
