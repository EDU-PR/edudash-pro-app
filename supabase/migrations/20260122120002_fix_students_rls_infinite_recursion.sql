-- Migration: Fix students RLS infinite recursion
-- Problem: Multiple students RLS policies were causing infinite recursion when evaluated
-- Root cause: Policies used functions that queried profiles table, which has RLS that uses
--            functions that query profiles again, causing an infinite loop
-- Solution: Simplified policies to use direct subqueries that don't chain through functions

-- ============================================================================
-- 1. Drop problematic duplicate function in app schema
-- ============================================================================
DROP FUNCTION IF EXISTS app.current_preschool_id() CASCADE;

-- ============================================================================
-- 2. Recreate current_preschool_id with proper SECURITY DEFINER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.current_preschool_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'extensions', 'auth'
AS $$
DECLARE
  preschool_id_claim TEXT;
  result_uuid UUID;
BEGIN
  -- First check if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  -- Try to get preschool_id from JWT claims first (fastest)
  preschool_id_claim := auth.jwt() ->> 'preschool_id';
  
  IF preschool_id_claim IS NOT NULL AND preschool_id_claim != '' THEN
    BEGIN
      result_uuid := preschool_id_claim::UUID;
      RETURN result_uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      NULL;
    END;
  END IF;
  
  -- Fallback: try organization_id claim
  preschool_id_claim := auth.jwt() ->> 'organization_id';
  IF preschool_id_claim IS NOT NULL AND preschool_id_claim != '' THEN
    BEGIN
      result_uuid := preschool_id_claim::UUID;
      RETURN result_uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      NULL;
    END;
  END IF;
  
  -- Fallback: lookup from profiles table (SECURITY DEFINER bypasses RLS)
  SELECT COALESCE(p.organization_id, p.preschool_id) INTO result_uuid
  FROM profiles p
  WHERE p.auth_user_id = auth.uid()
  LIMIT 1;
  
  IF result_uuid IS NOT NULL THEN
    RETURN result_uuid;
  END IF;
  
  -- Legacy fallback: lookup from users table
  SELECT COALESCE(u.organization_id, u.preschool_id) INTO result_uuid
  FROM users u
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;
  
  RETURN result_uuid;
END;
$$;

-- ============================================================================
-- 3. Drop all old students policies that caused recursion
-- ============================================================================
DO $sql$
DECLARE
  has_students boolean := to_regclass('public.students') IS NOT NULL;
  has_profiles boolean := to_regclass('public.profiles') IS NOT NULL;

  has_students_preschool_id boolean := false;
  has_students_parent_id boolean := false;
  has_students_guardian_id boolean := false;

  has_profiles_auth_user_id boolean := false;
  has_profiles_org_id boolean := false;
  has_profiles_preschool_id boolean := false;
  has_profiles_role boolean := false;

  has_is_superadmin_safe boolean := to_regprocedure('public.is_superadmin_safe()') IS NOT NULL;

  user_match text;
  school_match text;
  role_filter text;
  policy_sql text;
BEGIN
  IF has_students THEN
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
        AND column_name = 'parent_id'
    ) INTO has_students_parent_id;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'students'
        AND column_name = 'guardian_id'
    ) INTO has_students_guardian_id;
  END IF;

  IF has_profiles THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'auth_user_id'
    ) INTO has_profiles_auth_user_id;

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

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'role'
    ) INTO has_profiles_role;
  END IF;

  IF has_students THEN
    EXECUTE 'DROP POLICY IF EXISTS parents_view_school_students ON public.students';
    EXECUTE 'DROP POLICY IF EXISTS students_parent_access ON public.students';
    EXECUTE 'DROP POLICY IF EXISTS students_teacher_access ON public.students';
    EXECUTE 'DROP POLICY IF EXISTS students_principal_access ON public.students';
    EXECUTE 'DROP POLICY IF EXISTS students_select_by_preschool_authenticated ON public.students';
    EXECUTE 'DROP POLICY IF EXISTS students_superadmin_access ON public.students';
    EXECUTE 'DROP POLICY IF EXISTS students_service_full ON public.students';
    EXECUTE 'DROP POLICY IF EXISTS students_tenant_isolation_select ON public.students';
    EXECUTE 'DROP POLICY IF EXISTS students_tenant_modify ON public.students';
    EXECUTE 'DROP POLICY IF EXISTS students_parent_insert_own_children ON public.students';
    EXECUTE 'DROP POLICY IF EXISTS students_parent_update_own_children ON public.students';
  END IF;

  IF has_students THEN
    EXECUTE 'CREATE POLICY students_service_bypass ON public.students FOR ALL USING ((SELECT current_setting(''role'', true)) = ''service_role'' OR (SELECT current_setting(''is_superuser'', true))::boolean = true)';
    EXECUTE 'COMMENT ON POLICY students_service_bypass ON public.students IS ''Allow service role full access''';

    IF has_is_superadmin_safe THEN
      EXECUTE 'CREATE POLICY students_superadmin_all ON public.students FOR ALL USING (public.is_superadmin_safe())';
      EXECUTE 'COMMENT ON POLICY students_superadmin_all ON public.students IS ''Allow super admins full access''';
    END IF;

    IF has_profiles AND has_students_preschool_id AND (has_profiles_org_id OR has_profiles_preschool_id) THEN
      user_match := CASE WHEN has_profiles_auth_user_id THEN 'p.auth_user_id = auth.uid()' ELSE 'p.id = auth.uid()' END;

      IF has_profiles_org_id AND has_profiles_preschool_id THEN
        school_match := 'COALESCE(p.organization_id, p.preschool_id) = students.preschool_id';
      ELSIF has_profiles_org_id THEN
        school_match := 'p.organization_id = students.preschool_id';
      ELSE
        school_match := 'p.preschool_id = students.preschool_id';
      END IF;

      policy_sql := format(
        'CREATE POLICY students_school_staff_select ON public.students FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles p WHERE %s AND %s))',
        user_match,
        school_match
      );
      EXECUTE policy_sql;
      EXECUTE 'COMMENT ON POLICY students_school_staff_select ON public.students IS ''Allow school staff to view students in their school''';

      role_filter := '';
      IF has_profiles_role THEN
        role_filter := ' AND p.role IN (''principal'', ''admin'', ''super_admin'', ''superadmin'', ''preschool_admin'')';
      END IF;

      policy_sql := format(
        'CREATE POLICY students_school_admin_modify ON public.students FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE %s%s AND %s))',
        user_match,
        role_filter,
        school_match
      );
      EXECUTE policy_sql;
      EXECUTE 'COMMENT ON POLICY students_school_admin_modify ON public.students IS ''Allow school admins to modify students''';
    END IF;

    IF has_profiles AND (has_students_parent_id OR has_students_guardian_id) THEN
      user_match := CASE WHEN has_profiles_auth_user_id THEN 'p.auth_user_id = auth.uid()' ELSE 'p.id = auth.uid()' END;
      policy_sql := format(
        'CREATE POLICY students_parent_own_children ON public.students FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles p WHERE %s AND (%s)))',
        user_match,
        CASE
          WHEN has_students_parent_id AND has_students_guardian_id THEN '(students.parent_id = p.id OR students.guardian_id = p.id)'
          WHEN has_students_parent_id THEN '(students.parent_id = p.id)'
          ELSE '(students.guardian_id = p.id)'
        END
      );
      EXECUTE policy_sql;
      EXECUTE 'COMMENT ON POLICY students_parent_own_children ON public.students IS ''Allow parents to view their own children''';

      policy_sql := format(
        'CREATE POLICY students_parent_update_children ON public.students FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles p WHERE %s AND (%s)))',
        user_match,
        CASE
          WHEN has_students_parent_id AND has_students_guardian_id THEN '(students.parent_id = p.id OR students.guardian_id = p.id)'
          WHEN has_students_parent_id THEN '(students.parent_id = p.id)'
          ELSE '(students.guardian_id = p.id)'
        END
      );
      EXECUTE policy_sql;
      EXECUTE 'COMMENT ON POLICY students_parent_update_children ON public.students IS ''Allow parents to update their own children''';
    END IF;
  END IF;
END $sql$;
