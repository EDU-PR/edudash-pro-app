-- Migration: Update students RLS policies to check profiles table
-- Issue: Policies check legacy users table but principals may only exist in profiles table

DO $policies$
DECLARE
  has_students BOOLEAN;
  has_profiles BOOLEAN;
  has_profile_role BOOLEAN;
  has_profile_org BOOLEAN;
  has_profile_preschool BOOLEAN;
  has_users BOOLEAN;
  has_users_auth_user_id BOOLEAN;
  has_users_preschool BOOLEAN;
  has_users_role BOOLEAN;
  has_users_org BOOLEAN;
  has_users_id BOOLEAN;
  has_students_class_id BOOLEAN;
  has_classes BOOLEAN;
  has_classes_teacher_id BOOLEAN;
  principal_condition TEXT := '';
  select_condition TEXT := '';
  teacher_condition TEXT := '';
  tenant_condition TEXT := '';
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'students'
  ) INTO has_students;

  IF NOT has_students THEN
    RAISE NOTICE 'Skipping students RLS updates: students table missing';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) INTO has_profiles;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
  ) INTO has_profile_role;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'organization_id'
  ) INTO has_profile_org;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'preschool_id'
  ) INTO has_profile_preschool;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) INTO has_users;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'auth_user_id'
  ) INTO has_users_auth_user_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'preschool_id'
  ) INTO has_users_preschool;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
  ) INTO has_users_role;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'organization_id'
  ) INTO has_users_org;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id'
  ) INTO has_users_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'class_id'
  ) INTO has_students_class_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'classes'
  ) INTO has_classes;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'teacher_id'
  ) INTO has_classes_teacher_id;

  -- Principal access policy
  IF has_profiles AND has_profile_role AND (has_profile_org OR has_profile_preschool) THEN
    principal_condition := 'preschool_id IN (SELECT COALESCE(p.organization_id, p.preschool_id) FROM profiles p WHERE p.id = auth.uid() AND p.role IN (''principal'', ''preschool_admin'', ''admin'', ''superadmin'', ''super_admin''))';
  END IF;

  IF has_users AND has_users_auth_user_id AND has_users_preschool AND has_users_role THEN
    IF principal_condition <> '' THEN
      principal_condition := principal_condition || ' OR preschool_id IN (SELECT u.preschool_id FROM users u WHERE u.auth_user_id = auth.uid() AND u.role IN (''principal'', ''preschool_admin'', ''admin'', ''superadmin''))';
    ELSE
      principal_condition := 'preschool_id IN (SELECT u.preschool_id FROM users u WHERE u.auth_user_id = auth.uid() AND u.role IN (''principal'', ''preschool_admin'', ''admin'', ''superadmin''))';
    END IF;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS students_principal_access ON students';
  IF principal_condition <> '' THEN
    EXECUTE 'CREATE POLICY students_principal_access ON students FOR ALL USING (' || principal_condition || ')';
  ELSE
    RAISE NOTICE 'Skipping students_principal_access: required columns missing';
  END IF;

  -- Authenticated select policy
  IF has_profiles AND (has_profile_org OR has_profile_preschool) THEN
    select_condition := 'EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND COALESCE(p.organization_id, p.preschool_id) = students.preschool_id)';
  END IF;

  IF has_users AND has_users_auth_user_id AND has_users_preschool THEN
    IF select_condition <> '' THEN
      select_condition := select_condition || ' OR EXISTS (SELECT 1 FROM users u WHERE u.auth_user_id = auth.uid() AND u.preschool_id = students.preschool_id)';
    ELSE
      select_condition := 'EXISTS (SELECT 1 FROM users u WHERE u.auth_user_id = auth.uid() AND u.preschool_id = students.preschool_id)';
    END IF;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS students_select_by_preschool_authenticated ON students';
  IF select_condition <> '' THEN
    EXECUTE 'CREATE POLICY students_select_by_preschool_authenticated ON students FOR SELECT USING (' || select_condition || ')';
  ELSE
    RAISE NOTICE 'Skipping students_select_by_preschool_authenticated: required columns missing';
  END IF;

  -- Teacher access policy
  IF has_profiles AND has_profile_role AND (has_profile_org OR has_profile_preschool) AND has_students_class_id AND has_classes AND has_classes_teacher_id THEN
    teacher_condition := 'EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN (''teacher'', ''instructor'') AND COALESCE(p.organization_id, p.preschool_id) = students.preschool_id AND EXISTS (SELECT 1 FROM classes c WHERE c.teacher_id = p.id AND c.id = students.class_id))';
  END IF;

  IF has_users AND has_users_auth_user_id AND has_users_role AND has_users_preschool AND has_users_id AND has_students_class_id AND has_classes AND has_classes_teacher_id THEN
    IF teacher_condition <> '' THEN
      teacher_condition := teacher_condition || ' OR EXISTS (SELECT 1 FROM users u WHERE u.auth_user_id = auth.uid() AND u.role = ''teacher'' AND u.preschool_id = students.preschool_id AND EXISTS (SELECT 1 FROM classes c WHERE c.teacher_id = u.id AND c.id = students.class_id))';
    ELSE
      teacher_condition := 'EXISTS (SELECT 1 FROM users u WHERE u.auth_user_id = auth.uid() AND u.role = ''teacher'' AND u.preschool_id = students.preschool_id AND EXISTS (SELECT 1 FROM classes c WHERE c.teacher_id = u.id AND c.id = students.class_id))';
    END IF;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS students_teacher_access ON students';
  IF teacher_condition <> '' THEN
    EXECUTE 'CREATE POLICY students_teacher_access ON students FOR SELECT USING (' || teacher_condition || ')';
  ELSE
    RAISE NOTICE 'Skipping students_teacher_access: required columns missing';
  END IF;

  -- Tenant modify policy
  IF has_profiles AND (has_profile_org OR has_profile_preschool) THEN
    tenant_condition := 'preschool_id IN (SELECT COALESCE(p.organization_id, p.preschool_id) FROM profiles p WHERE p.id = auth.uid())';
  END IF;

  IF has_users AND has_users_id AND (has_users_org OR has_users_preschool) AND has_users_auth_user_id THEN
    IF tenant_condition <> '' THEN
      tenant_condition := tenant_condition || ' OR preschool_id IN (SELECT COALESCE(u.organization_id, u.preschool_id) FROM users u WHERE u.id = auth.uid() OR u.auth_user_id = auth.uid())';
    ELSE
      tenant_condition := 'preschool_id IN (SELECT COALESCE(u.organization_id, u.preschool_id) FROM users u WHERE u.id = auth.uid() OR u.auth_user_id = auth.uid())';
    END IF;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS students_tenant_modify ON students';
  IF tenant_condition <> '' THEN
    EXECUTE 'CREATE POLICY students_tenant_modify ON students FOR ALL USING (' || tenant_condition || ')';
  ELSE
    RAISE NOTICE 'Skipping students_tenant_modify: required columns missing';
  END IF;

  -- Comments
  IF principal_condition <> '' THEN
    EXECUTE 'COMMENT ON POLICY students_principal_access ON students IS ''Allows principals, admins, and superadmins to access all students in their school. Checks both profiles and legacy users table.''';
  END IF;
  IF select_condition <> '' THEN
    EXECUTE 'COMMENT ON POLICY students_select_by_preschool_authenticated ON students IS ''Allows authenticated users to view students in their school. Checks both profiles and legacy users table.''';
  END IF;
END;
$policies$;
