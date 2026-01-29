-- Migration: Fix parent auth_user_id and enable multi-parent RLS support

DO $sql$
DECLARE
  has_profiles boolean := to_regclass('public.profiles') IS NOT NULL;
  has_students boolean := to_regclass('public.students') IS NOT NULL;
  has_spr boolean := to_regclass('public.student_parent_relationships') IS NOT NULL;
  has_updated_at boolean := false;
  parent_condition text;
  policy_sql text;
BEGIN
  IF has_profiles THEN
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS auth_user_id uuid,
      ADD COLUMN IF NOT EXISTS updated_at timestamptz;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'updated_at'
    ) INTO has_updated_at;

    IF has_updated_at THEN
      EXECUTE 'UPDATE public.profiles p SET auth_user_id = p.id, updated_at = NOW() WHERE p.role = ''parent'' AND p.auth_user_id IS NULL AND EXISTS (SELECT 1 FROM auth.users a WHERE a.id = p.id)';
    ELSE
      EXECUTE 'UPDATE public.profiles p SET auth_user_id = p.id WHERE p.role = ''parent'' AND p.auth_user_id IS NULL AND EXISTS (SELECT 1 FROM auth.users a WHERE a.id = p.id)';
    END IF;
  END IF;

  IF has_students AND has_profiles THEN
    EXECUTE 'DROP POLICY IF EXISTS students_parent_own_children ON public.students';
    EXECUTE 'DROP POLICY IF EXISTS students_parent_update_own_children ON public.students';

    parent_condition := 'students.parent_id = p.id OR students.guardian_id = p.id';
    IF has_spr THEN
      parent_condition := parent_condition || ' OR EXISTS (SELECT 1 FROM public.student_parent_relationships spr WHERE spr.student_id = students.id AND spr.parent_id = p.id)';
    END IF;

    policy_sql := format(
      'CREATE POLICY students_parent_own_children ON public.students FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_user_id = auth.uid() AND (%s)))',
      parent_condition
    );
    EXECUTE policy_sql;

    policy_sql := format(
      'CREATE POLICY students_parent_update_own_children ON public.students FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_user_id = auth.uid() AND (%s))) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_user_id = auth.uid() AND (%s)))',
      parent_condition,
      parent_condition
    );
    EXECUTE policy_sql;
  END IF;

  IF has_spr THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_student_parent_relationships_student_id ON public.student_parent_relationships(student_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_student_parent_relationships_parent_id ON public.student_parent_relationships(parent_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_student_parent_relationships_composite ON public.student_parent_relationships(student_id, parent_id)';
  END IF;
END $sql$;
