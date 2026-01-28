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
DROP POLICY IF EXISTS parents_view_school_students ON students;
DROP POLICY IF EXISTS students_parent_access ON students;
DROP POLICY IF EXISTS students_teacher_access ON students;
DROP POLICY IF EXISTS students_principal_access ON students;
DROP POLICY IF EXISTS students_select_by_preschool_authenticated ON students;
DROP POLICY IF EXISTS students_superadmin_access ON students;
DROP POLICY IF EXISTS students_service_full ON students;
DROP POLICY IF EXISTS students_tenant_isolation_select ON students;
DROP POLICY IF EXISTS students_tenant_modify ON students;
DROP POLICY IF EXISTS students_parent_insert_own_children ON students;
DROP POLICY IF EXISTS students_parent_update_own_children ON students;

-- ============================================================================
-- 4. Create new, non-recursive students policies
-- ============================================================================

-- Service role bypass
CREATE POLICY students_service_bypass ON students
FOR ALL
USING (
  (SELECT current_setting('role', true)) = 'service_role'
  OR (SELECT current_setting('is_superuser', true))::boolean = true
);

-- Super admin access (uses SECURITY DEFINER function)
CREATE POLICY students_superadmin_all ON students
FOR ALL
USING (is_superadmin_safe());

-- School staff (principals, teachers, admins) can view all students in their school
CREATE POLICY students_school_staff_select ON students
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.auth_user_id = auth.uid()
      AND COALESCE(p.organization_id, p.preschool_id) = students.preschool_id
  )
);

-- School admins can modify students
CREATE POLICY students_school_admin_modify ON students
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.auth_user_id = auth.uid()
      AND COALESCE(p.organization_id, p.preschool_id) = students.preschool_id
      AND p.role IN ('principal', 'admin', 'super_admin', 'superadmin', 'preschool_admin')
  )
);

-- Parents can view their own children
CREATE POLICY students_parent_own_children ON students
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.auth_user_id = auth.uid()
      AND (students.parent_id = p.id OR students.guardian_id = p.id)
  )
);

-- Parents can update their own children (limited fields controlled at app level)
CREATE POLICY students_parent_update_children ON students
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.auth_user_id = auth.uid()
      AND (students.parent_id = p.id OR students.guardian_id = p.id)
  )
);

-- ============================================================================
-- Add comments
-- ============================================================================
COMMENT ON POLICY students_service_bypass ON students IS 'Allow service role full access';
COMMENT ON POLICY students_superadmin_all ON students IS 'Allow super admins full access';
COMMENT ON POLICY students_school_staff_select ON students IS 'Allow school staff to view students in their school';
COMMENT ON POLICY students_school_admin_modify ON students IS 'Allow school admins to modify students';
COMMENT ON POLICY students_parent_own_children ON students IS 'Allow parents to view their own children';
COMMENT ON POLICY students_parent_update_children ON students IS 'Allow parents to update their own children';
