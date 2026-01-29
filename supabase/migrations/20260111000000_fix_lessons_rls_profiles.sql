-- Fix lessons RLS policies to use profiles instead of users
-- Date: 2026-01-11
-- Issue: Teachers can't save lessons because RLS policies reference 'users' table
-- which doesn't contain their data (data is in 'profiles' table)

DO $$
DECLARE
  has_lessons boolean;
  has_profiles boolean;
  has_teacher_id boolean;
  has_preschool_id boolean;
  has_is_public boolean;
BEGIN
  has_lessons := to_regclass('public.lessons') IS NOT NULL;
  has_profiles := to_regclass('public.profiles') IS NOT NULL;

  IF NOT has_lessons OR NOT has_profiles THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lessons'
      AND column_name = 'teacher_id'
  ) INTO has_teacher_id;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lessons'
      AND column_name = 'preschool_id'
  ) INTO has_preschool_id;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lessons'
      AND column_name = 'is_public'
  ) INTO has_is_public;

  IF NOT has_teacher_id OR NOT has_preschool_id THEN
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS "lessons_teacher_access" ON public.lessons';
  EXECUTE 'DROP POLICY IF EXISTS "lessons_tenant_access" ON public.lessons';

  EXECUTE $ddl$
    CREATE POLICY "lessons_teacher_insert"
    ON public.lessons
    FOR INSERT
    TO authenticated
    WITH CHECK (
      teacher_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'teacher'
        AND p.preschool_id = lessons.preschool_id
      )
    )
  $ddl$;

  EXECUTE $ddl$
    CREATE POLICY "lessons_teacher_update"
    ON public.lessons
    FOR UPDATE
    TO authenticated
    USING (
      teacher_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'teacher'
        AND p.preschool_id = lessons.preschool_id
      )
    )
    WITH CHECK (
      teacher_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'teacher'
        AND p.preschool_id = lessons.preschool_id
      )
    )
  $ddl$;

  EXECUTE $ddl$
    CREATE POLICY "lessons_teacher_delete"
    ON public.lessons
    FOR DELETE
    TO authenticated
    USING (
      teacher_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'teacher'
        AND p.preschool_id = lessons.preschool_id
      )
    )
  $ddl$;

  IF has_is_public THEN
    EXECUTE $ddl$
      CREATE POLICY "lessons_teacher_select"
      ON public.lessons
      FOR SELECT
      TO authenticated
      USING (
        teacher_id = auth.uid()
        OR preschool_id IN (
          SELECT p.preschool_id FROM public.profiles p WHERE p.id = auth.uid()
        )
        OR is_public = true
      )
    $ddl$;
  ELSE
    EXECUTE $ddl$
      CREATE POLICY "lessons_teacher_select"
      ON public.lessons
      FOR SELECT
      TO authenticated
      USING (
        teacher_id = auth.uid()
        OR preschool_id IN (
          SELECT p.preschool_id FROM public.profiles p WHERE p.id = auth.uid()
        )
      )
    $ddl$;
  END IF;

  EXECUTE $ddl$
    CREATE POLICY "lessons_principal_access"
    ON public.lessons
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role IN ('principal', 'admin', 'preschool_admin')
        AND p.preschool_id = lessons.preschool_id
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role IN ('principal', 'admin', 'preschool_admin')
        AND p.preschool_id = lessons.preschool_id
      )
    )
  $ddl$;
END $$;
