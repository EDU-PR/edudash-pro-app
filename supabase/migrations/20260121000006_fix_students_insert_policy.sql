-- filepath: supabase/migrations/20260121000006_fix_students_insert_policy.sql
-- Migration: Fix students INSERT policy for principals
-- Issue: students_principal_access policy has USING clause but no WITH CHECK clause
-- For INSERT operations, WITH CHECK is required to validate the new row data

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
  principal_condition TEXT := '';
  tenant_condition TEXT := '';
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'students'
  ) INTO has_students;

  IF NOT has_students THEN
    RAISE NOTICE 'Skipping students INSERT policy fix: students table missing';
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
    EXECUTE 'CREATE POLICY students_principal_access ON students FOR ALL USING (' || principal_condition || ') WITH CHECK (' || principal_condition || ')';
  ELSE
    RAISE NOTICE 'Skipping students_principal_access: required columns missing';
  END IF;

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
    EXECUTE 'CREATE POLICY students_tenant_modify ON students FOR ALL USING (' || tenant_condition || ') WITH CHECK (' || tenant_condition || ')';
  ELSE
    RAISE NOTICE 'Skipping students_tenant_modify: required columns missing';
  END IF;

  IF principal_condition <> '' THEN
    EXECUTE 'COMMENT ON POLICY students_principal_access ON students IS ''Allows principals, admins, and superadmins to manage all students in their school. WITH CHECK clause enables INSERT operations.''';
  END IF;
  IF tenant_condition <> '' THEN
    EXECUTE 'COMMENT ON POLICY students_tenant_modify ON students IS ''Allows users to manage students in their own school. WITH CHECK clause enables INSERT operations.''';
  END IF;
END;
$policies$;
