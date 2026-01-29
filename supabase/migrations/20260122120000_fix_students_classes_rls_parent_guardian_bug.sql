-- Migration: Fix students and classes RLS policies that incorrectly use parent_id/guardian_id = auth.uid()
-- Problem: These policies check parent_id = auth.uid() or guardian_id = auth.uid()
-- But parent_id and guardian_id contain profile.id values, not auth.users UUIDs
-- Solution: Join to profiles table to check auth_user_id (if present) and compare with profile.id

DO $sql$
DECLARE
  has_profiles boolean := to_regclass('public.profiles') IS NOT NULL;
  has_students boolean := to_regclass('public.students') IS NOT NULL;
  has_classes boolean := to_regclass('public.classes') IS NOT NULL;

  has_auth_user_id boolean := false;
  has_profiles_role boolean := false;
  has_profiles_org_id boolean := false;
  has_profiles_preschool_id boolean := false;

  has_students_parent_id boolean := false;
  has_students_guardian_id boolean := false;
  has_students_preschool_id boolean := false;
  has_students_class_id boolean := false;

  has_classes_preschool_id boolean := false;
  has_classes_teacher_id boolean := false;
  has_user_can_view_classes boolean := false;

  base_user_match text;
  parent_only text;
  org_match text;
  parent_or_org text;
  role_filter text;
  policy_sql text;
BEGIN
  IF has_profiles THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'auth_user_id'
    ) INTO has_auth_user_id;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'role'
    ) INTO has_profiles_role;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'organization_id'
    ) INTO has_profiles_org_id;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'preschool_id'
    ) INTO has_profiles_preschool_id;
  END IF;

  IF has_students THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'students'
        AND column_name = 'parent_id'
    ) INTO has_students_parent_id;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'students'
        AND column_name = 'guardian_id'
    ) INTO has_students_guardian_id;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'students'
        AND column_name = 'preschool_id'
    ) INTO has_students_preschool_id;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'students'
        AND column_name = 'class_id'
    ) INTO has_students_class_id;
  END IF;

  IF has_classes THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'classes'
        AND column_name = 'preschool_id'
    ) INTO has_classes_preschool_id;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'classes'
        AND column_name = 'teacher_id'
    ) INTO has_classes_teacher_id;
  END IF;

  SELECT to_regprocedure('public.user_can_view_classes(uuid, uuid)') IS NOT NULL
    INTO has_user_can_view_classes;

  IF has_students THEN
    EXECUTE 'DROP POLICY IF EXISTS parents_view_school_students ON public.students';
    EXECUTE 'DROP POLICY IF EXISTS students_parent_access ON public.students';
    EXECUTE 'DROP POLICY IF EXISTS students_parent_update_own_children ON public.students';
  END IF;

  IF has_classes THEN
    EXECUTE 'DROP POLICY IF EXISTS parents_view_child_classes ON public.classes';
    EXECUTE 'DROP POLICY IF EXISTS classes_org_members_select ON public.classes';
  END IF;

  IF has_profiles AND has_students AND has_students_parent_id AND has_students_guardian_id THEN
    base_user_match := CASE WHEN has_auth_user_id THEN 'p.auth_user_id = auth.uid()' ELSE 'p.id = auth.uid()' END;
    parent_only := '(students.parent_id = p.id OR students.guardian_id = p.id)';

    org_match := NULL;
    IF has_students_preschool_id AND (has_profiles_org_id OR has_profiles_preschool_id) THEN
      IF has_profiles_org_id AND has_profiles_preschool_id THEN
        org_match := 'COALESCE(p.organization_id, p.preschool_id) = students.preschool_id';
      ELSIF has_profiles_org_id THEN
        org_match := 'p.organization_id = students.preschool_id';
      ELSE
        org_match := 'p.preschool_id = students.preschool_id';
      END IF;
    END IF;

    parent_or_org := parent_only;
    IF org_match IS NOT NULL THEN
      parent_or_org := parent_or_org || ' OR ' || org_match;
    END IF;

    policy_sql := format(
      'CREATE POLICY parents_view_school_students ON public.students FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE %s AND (%s)))',
      base_user_match,
      parent_or_org
    );
    EXECUTE policy_sql;

    role_filter := '';
    IF has_profiles_role THEN
      role_filter := ' AND p.role = ''parent''';
    END IF;

    policy_sql := format(
      'CREATE POLICY students_parent_access ON public.students FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE %s%s AND (%s)))',
      base_user_match,
      role_filter,
      parent_or_org
    );
    EXECUTE policy_sql;

    policy_sql := format(
      'CREATE POLICY students_parent_update_own_children ON public.students FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE %s AND %s)) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE %s AND %s))',
      base_user_match,
      parent_only,
      base_user_match,
      parent_only
    );
    EXECUTE policy_sql;
  END IF;

  IF has_classes AND has_students AND has_students_class_id AND has_profiles AND has_students_parent_id AND has_students_guardian_id THEN
    base_user_match := CASE WHEN has_auth_user_id THEN 'p.auth_user_id = auth.uid()' ELSE 'p.id = auth.uid()' END;
    policy_sql := format(
      'CREATE POLICY parents_view_child_classes ON public.classes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.students s JOIN public.profiles p ON (s.parent_id = p.id OR s.guardian_id = p.id) WHERE %s AND s.class_id = classes.id)',
      base_user_match
    );

    IF has_user_can_view_classes AND has_classes_preschool_id AND has_classes_teacher_id THEN
      policy_sql := policy_sql || ' OR public.user_can_view_classes(classes.preschool_id, classes.teacher_id)';
    END IF;

    policy_sql := policy_sql || ')';
    EXECUTE policy_sql;
  END IF;

  IF has_classes AND has_profiles AND has_classes_preschool_id AND (has_profiles_org_id OR has_profiles_preschool_id) THEN
    base_user_match := CASE WHEN has_auth_user_id THEN 'p.auth_user_id = auth.uid()' ELSE 'p.id = auth.uid()' END;

    IF has_profiles_org_id AND has_profiles_preschool_id THEN
      org_match := 'COALESCE(p.organization_id, p.preschool_id) = classes.preschool_id';
    ELSIF has_profiles_org_id THEN
      org_match := 'p.organization_id = classes.preschool_id';
    ELSE
      org_match := 'p.preschool_id = classes.preschool_id';
    END IF;

    policy_sql := format(
      'CREATE POLICY classes_org_members_select ON public.classes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE %s AND %s))',
      base_user_match,
      org_match
    );
    EXECUTE policy_sql;
  END IF;
END $sql$;
