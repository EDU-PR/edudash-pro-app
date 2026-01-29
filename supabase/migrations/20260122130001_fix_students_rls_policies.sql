-- Fix students table RLS policies
-- Multiple policies incorrectly use profiles.id = auth.uid()
-- but it should be profiles.auth_user_id = auth.uid()
-- auth.uid() returns the authenticated user's UUID from auth.users table
-- which matches auth_user_id in profiles, NOT the profile's id column

DO $sql$
DECLARE
  has_students boolean := to_regclass('public.students') IS NOT NULL;
  has_profiles boolean := to_regclass('public.profiles') IS NOT NULL;
  has_users boolean := to_regclass('public.users') IS NOT NULL;
  has_classes boolean := to_regclass('public.classes') IS NOT NULL;

  has_students_parent_id boolean := false;
  has_students_guardian_id boolean := false;
  has_students_preschool_id boolean := false;
  has_students_class_id boolean := false;

  has_profiles_auth_user_id boolean := false;
  has_profiles_role boolean := false;
  has_profiles_org_id boolean := false;
  has_profiles_preschool_id boolean := false;

  has_users_auth_user_id boolean := false;
  has_users_role boolean := false;
  has_users_org_id boolean := false;
  has_users_preschool_id boolean := false;

  has_classes_teacher_id boolean := false;

  profiles_user_match text;
  users_user_match text;
  profiles_school_match text;
  users_school_match text;
  direct_parent text;
  child_school text;
  staff_cond text;
  conds text[];
  policy_sql text;
BEGIN
  IF has_students THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'parent_id'
    ) INTO has_students_parent_id;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'guardian_id'
    ) INTO has_students_guardian_id;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'preschool_id'
    ) INTO has_students_preschool_id;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'class_id'
    ) INTO has_students_class_id;
  END IF;

  IF has_profiles THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'auth_user_id'
    ) INTO has_profiles_auth_user_id;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
    ) INTO has_profiles_role;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'organization_id'
    ) INTO has_profiles_org_id;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'preschool_id'
    ) INTO has_profiles_preschool_id;
  END IF;

  IF has_users THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'auth_user_id'
    ) INTO has_users_auth_user_id;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
    ) INTO has_users_role;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'organization_id'
    ) INTO has_users_org_id;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'preschool_id'
    ) INTO has_users_preschool_id;
  END IF;

  IF has_classes THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'teacher_id'
    ) INTO has_classes_teacher_id;
  END IF;

  IF has_students THEN
    EXECUTE 'DROP POLICY IF EXISTS "parents_view_school_students" ON public.students';
    EXECUTE 'DROP POLICY IF EXISTS "students_parent_access" ON public.students';
    EXECUTE 'DROP POLICY IF EXISTS "students_select_by_preschool_authenticated" ON public.students';
    EXECUTE 'DROP POLICY IF EXISTS "students_teacher_access" ON public.students';
    EXECUTE 'DROP POLICY IF EXISTS "students_tenant_modify" ON public.students';
    EXECUTE 'DROP POLICY IF EXISTS "students_principal_access" ON public.students';
  END IF;

  IF NOT has_students THEN
    RETURN;
  END IF;

  profiles_user_match := NULL;
  users_user_match := NULL;

  IF has_profiles THEN
    profiles_user_match := CASE WHEN has_profiles_auth_user_id THEN 'p.auth_user_id = auth.uid()' ELSE 'p.id = auth.uid()' END;
  END IF;

  IF has_users THEN
    users_user_match := CASE WHEN has_users_auth_user_id THEN 'u.auth_user_id = auth.uid()' ELSE 'u.id = auth.uid()' END;
  END IF;

  IF has_profiles AND has_students_preschool_id AND (has_profiles_org_id OR has_profiles_preschool_id) THEN
    IF has_profiles_org_id AND has_profiles_preschool_id THEN
      profiles_school_match := 'COALESCE(p.organization_id, p.preschool_id) = students.preschool_id';
    ELSIF has_profiles_org_id THEN
      profiles_school_match := 'p.organization_id = students.preschool_id';
    ELSE
      profiles_school_match := 'p.preschool_id = students.preschool_id';
    END IF;
  END IF;

  IF has_users AND has_students_preschool_id AND (has_users_org_id OR has_users_preschool_id) THEN
    IF has_users_org_id AND has_users_preschool_id THEN
      users_school_match := 'COALESCE(u.organization_id, u.preschool_id) = students.preschool_id';
    ELSIF has_users_org_id THEN
      users_school_match := 'u.organization_id = students.preschool_id';
    ELSE
      users_school_match := 'u.preschool_id = students.preschool_id';
    END IF;
  END IF;

  -- parents_view_school_students
  conds := ARRAY[]::text[];

  IF has_students_parent_id THEN
    direct_parent := '(parent_id = auth.uid())';
    conds := array_append(conds, direct_parent);
  END IF;

  IF has_students_guardian_id THEN
    conds := array_append(conds, '(guardian_id = auth.uid())');
  END IF;

  IF has_students_preschool_id AND (has_students_parent_id OR has_students_guardian_id) THEN
    child_school := 'preschool_id IN (SELECT s.preschool_id FROM public.students s WHERE (' ||
      (CASE
        WHEN has_students_parent_id AND has_students_guardian_id THEN '(s.parent_id = auth.uid() OR s.guardian_id = auth.uid())'
        WHEN has_students_parent_id THEN '(s.parent_id = auth.uid())'
        ELSE '(s.guardian_id = auth.uid())'
      END) ||
      ') AND s.preschool_id IS NOT NULL)';
    conds := array_append(conds, child_school);
  END IF;

  IF profiles_user_match IS NOT NULL AND profiles_school_match IS NOT NULL THEN
    staff_cond := 'EXISTS (SELECT 1 FROM public.profiles p WHERE ' || profiles_user_match || ' AND ' || profiles_school_match || ')';
    conds := array_append(conds, staff_cond);
  END IF;

  IF array_length(conds, 1) > 0 THEN
    policy_sql := 'CREATE POLICY "parents_view_school_students" ON public.students FOR SELECT USING (' || array_to_string(conds, ' OR ') || ')';
    EXECUTE policy_sql;
    EXECUTE 'COMMENT ON POLICY "parents_view_school_students" ON public.students IS ''Parents can view students at their school. Fixed to use auth_user_id instead of id.''';
  END IF;

  -- students_parent_access
  conds := ARRAY[]::text[];
  IF has_students_parent_id THEN
    conds := array_append(conds, '(parent_id = auth.uid())');
  END IF;
  IF has_students_guardian_id THEN
    conds := array_append(conds, '(guardian_id = auth.uid())');
  END IF;

  IF profiles_user_match IS NOT NULL AND profiles_school_match IS NOT NULL THEN
    staff_cond := 'EXISTS (SELECT 1 FROM public.profiles p WHERE ' || profiles_user_match;
    IF has_profiles_role THEN
      staff_cond := staff_cond || ' AND p.role = ''parent''';
    END IF;
    staff_cond := staff_cond || ' AND (' || profiles_school_match || '))';
    conds := array_append(conds, staff_cond);
  END IF;

  IF array_length(conds, 1) > 0 THEN
    policy_sql := 'CREATE POLICY "students_parent_access" ON public.students FOR SELECT USING (' || array_to_string(conds, ' OR ') || ')';
    EXECUTE policy_sql;
    EXECUTE 'COMMENT ON POLICY "students_parent_access" ON public.students IS ''Parent access to students. Fixed to use auth_user_id instead of id.''';
  END IF;

  -- students_select_by_preschool_authenticated
  conds := ARRAY[]::text[];
  IF profiles_user_match IS NOT NULL AND profiles_school_match IS NOT NULL THEN
    conds := array_append(conds, 'EXISTS (SELECT 1 FROM public.profiles p WHERE ' || profiles_user_match || ' AND ' || profiles_school_match || ')');
  END IF;

  IF users_user_match IS NOT NULL AND users_school_match IS NOT NULL THEN
    conds := array_append(conds, 'EXISTS (SELECT 1 FROM public.users u WHERE ' || users_user_match || ' AND ' || users_school_match || ')');
  END IF;

  IF array_length(conds, 1) > 0 THEN
    policy_sql := 'CREATE POLICY "students_select_by_preschool_authenticated" ON public.students FOR SELECT USING (' || array_to_string(conds, ' OR ') || ')';
    EXECUTE policy_sql;
    EXECUTE 'COMMENT ON POLICY "students_select_by_preschool_authenticated" ON public.students IS ''Authenticated users can view students at their preschool. Fixed to use auth_user_id.''';
  END IF;

  -- students_teacher_access
  conds := ARRAY[]::text[];
  IF has_students_class_id AND has_classes AND has_classes_teacher_id AND profiles_user_match IS NOT NULL AND profiles_school_match IS NOT NULL THEN
    staff_cond := 'EXISTS (SELECT 1 FROM public.profiles p WHERE ' || profiles_user_match;
    IF has_profiles_role THEN
      staff_cond := staff_cond || ' AND p.role IN (''teacher'', ''instructor'')';
    END IF;
    staff_cond := staff_cond || ' AND ' || profiles_school_match ||
      ' AND EXISTS (SELECT 1 FROM public.classes c WHERE c.teacher_id = p.id AND c.id = students.class_id))';
    conds := array_append(conds, staff_cond);
  END IF;

  IF has_students_class_id AND has_classes AND has_classes_teacher_id AND users_user_match IS NOT NULL AND users_school_match IS NOT NULL THEN
    staff_cond := 'EXISTS (SELECT 1 FROM public.users u WHERE ' || users_user_match;
    IF has_users_role THEN
      staff_cond := staff_cond || ' AND u.role = ''teacher''';
    END IF;
    staff_cond := staff_cond || ' AND ' || users_school_match ||
      ' AND EXISTS (SELECT 1 FROM public.classes c WHERE c.teacher_id = u.id AND c.id = students.class_id))';
    conds := array_append(conds, staff_cond);
  END IF;

  IF array_length(conds, 1) > 0 THEN
    policy_sql := 'CREATE POLICY "students_teacher_access" ON public.students FOR SELECT USING (' || array_to_string(conds, ' OR ') || ')';
    EXECUTE policy_sql;
    EXECUTE 'COMMENT ON POLICY "students_teacher_access" ON public.students IS ''Teachers can view students in their classes. Fixed to use auth_user_id.''';
  END IF;

  -- students_tenant_modify
  conds := ARRAY[]::text[];
  IF profiles_user_match IS NOT NULL AND profiles_school_match IS NOT NULL THEN
    conds := array_append(conds, 'SELECT COALESCE(p.organization_id, p.preschool_id) FROM public.profiles p WHERE ' || profiles_user_match);
  END IF;
  IF users_user_match IS NOT NULL AND users_school_match IS NOT NULL THEN
    conds := array_append(conds, 'SELECT COALESCE(u.organization_id, u.preschool_id) FROM public.users u WHERE ' || users_user_match);
  END IF;

  IF array_length(conds, 1) > 0 AND has_students_preschool_id THEN
    policy_sql := 'CREATE POLICY "students_tenant_modify" ON public.students FOR ALL USING (preschool_id IN (' || array_to_string(conds, ' UNION ') || '))';
    EXECUTE policy_sql;
    EXECUTE 'COMMENT ON POLICY "students_tenant_modify" ON public.students IS ''Tenant members can modify students. Fixed to use auth_user_id.''';
  END IF;

  -- students_principal_access
  conds := ARRAY[]::text[];
  IF profiles_user_match IS NOT NULL AND has_profiles_role AND profiles_school_match IS NOT NULL THEN
    conds := array_append(conds, 'SELECT COALESCE(p.organization_id, p.preschool_id) FROM public.profiles p WHERE ' || profiles_user_match ||
      ' AND p.role IN (''principal'', ''preschool_admin'', ''admin'', ''superadmin'', ''super_admin'')');
  END IF;

  IF users_user_match IS NOT NULL AND has_users_role AND has_users_preschool_id THEN
    conds := array_append(conds, 'SELECT u.preschool_id FROM public.users u WHERE ' || users_user_match ||
      ' AND u.role IN (''principal'', ''preschool_admin'', ''admin'', ''superadmin'')');
  END IF;

  IF array_length(conds, 1) > 0 AND has_students_preschool_id THEN
    policy_sql := 'CREATE POLICY "students_principal_access" ON public.students FOR ALL USING (preschool_id IN (' || array_to_string(conds, ' UNION ') || '))';
    EXECUTE policy_sql;
    EXECUTE 'COMMENT ON POLICY "students_principal_access" ON public.students IS ''Principals can manage all students at their school. Fixed to use auth_user_id.''';
  END IF;
END $sql$;
