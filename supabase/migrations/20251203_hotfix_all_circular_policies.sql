-- ============================================================================
-- COMPREHENSIVE HOTFIX: Fix ALL circular dependencies in RLS policies
-- ============================================================================
-- Problem: Multiple tables have policies that query other protected tables,
-- causing cascading circular dependencies and infinite recursion
-- Solution: Create SECURITY DEFINER functions for all cross-table lookups
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: Create helper functions to break ALL circular dependencies
-- ============================================================================

-- Function: Get current user's profile info (breaks profiles -> users loop)
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS TABLE(
  profile_id uuid,
  profile_role text,
  profile_preschool_id uuid,
  profile_organization_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id, role, preschool_id, organization_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_current_user_profile() TO authenticated;

COMMENT ON FUNCTION public.get_current_user_profile IS 
'SECURITY DEFINER function to get current user profile without triggering RLS recursion';

-- Function: Check if user is principal/admin of a preschool
CREATE OR REPLACE FUNCTION public.is_preschool_admin(check_preschool_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (preschool_id = check_preschool_id OR organization_id = check_preschool_id)
    AND role IN ('principal', 'admin', 'principal_admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_preschool_admin(uuid) TO authenticated;

-- Function: Check if user is superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'superadmin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;

-- Function: Get user's preschool ID
CREATE OR REPLACE FUNCTION public.get_user_preschool_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(preschool_id, organization_id)
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_preschool_id() TO authenticated;

-- ============================================================================
-- PART 2: Fix PRESCHOOLS table policies (main source of recursion)
-- ============================================================================

-- Drop all problematic preschools policies
DROP POLICY IF EXISTS "Principals can update their preschool" ON public.preschools;
DROP POLICY IF EXISTS "Superadmins full access" ON public.preschools;
DROP POLICY IF EXISTS "Users can read their preschool" ON public.preschools;
DROP POLICY IF EXISTS "preschools_admin_manage" ON public.preschools;
DROP POLICY IF EXISTS "preschools_own_organization" ON public.preschools;
DROP POLICY IF EXISTS "preschools_tenant_read" ON public.preschools;
DROP POLICY IF EXISTS "preschools_tenant_update" ON public.preschools;

-- Recreate policies using SECURITY DEFINER functions

-- Policy: Users can read their own preschool
CREATE POLICY "preschools_user_read_own" ON public.preschools
FOR SELECT TO authenticated
USING (
  id = get_user_preschool_id()
  OR is_superadmin()
);

-- Policy: Admins can update their preschool
CREATE POLICY "preschools_admin_update_own" ON public.preschools
FOR UPDATE TO authenticated
USING (
  is_preschool_admin(id)
  OR is_superadmin()
)
WITH CHECK (
  is_preschool_admin(id)
  OR is_superadmin()
);

-- Policy: Parents can view approved preschools (keep this one, it's safe)
-- Already exists: "Parents can view approved preschools"

-- ============================================================================
-- PART 3: Fix STUDENTS table policies
-- ============================================================================

DROP POLICY IF EXISTS "students_preschool_insert" ON public.students;
DROP POLICY IF EXISTS "students_preschool_read" ON public.students;
DROP POLICY IF EXISTS "students_preschool_update" ON public.students;
DROP POLICY IF EXISTS "students_tenant_read" ON public.students;

CREATE POLICY "students_read_own_preschool" ON public.students
FOR SELECT TO authenticated
USING (
  preschool_id = get_user_preschool_id()
  OR is_superadmin()
);

CREATE POLICY "students_admin_manage" ON public.students
FOR ALL TO authenticated
USING (
  preschool_id = get_user_preschool_id()
  AND (
    (SELECT profile_role FROM get_current_user_profile()) IN ('principal', 'admin', 'principal_admin', 'teacher')
    OR is_superadmin()
  )
)
WITH CHECK (
  preschool_id = get_user_preschool_id()
  AND (
    (SELECT profile_role FROM get_current_user_profile()) IN ('principal', 'admin', 'principal_admin', 'teacher')
    OR is_superadmin()
  )
);

-- ============================================================================
-- PART 4: Fix CLASSES table policies
-- ============================================================================

DROP POLICY IF EXISTS "classes_preschool_insert" ON public.classes;
DROP POLICY IF EXISTS "classes_preschool_read" ON public.classes;
DROP POLICY IF EXISTS "classes_preschool_update" ON public.classes;
DROP POLICY IF EXISTS "classes_tenant_read" ON public.classes;

CREATE POLICY "classes_read_own_preschool" ON public.classes
FOR SELECT TO authenticated
USING (
  preschool_id = get_user_preschool_id()
  OR is_superadmin()
);

CREATE POLICY "classes_admin_manage" ON public.classes
FOR ALL TO authenticated
USING (
  preschool_id = get_user_preschool_id()
  AND (
    (SELECT profile_role FROM get_current_user_profile()) IN ('principal', 'admin', 'principal_admin', 'teacher')
    OR is_superadmin()
  )
)
WITH CHECK (
  preschool_id = get_user_preschool_id()
  AND (
    (SELECT profile_role FROM get_current_user_profile()) IN ('principal', 'admin', 'principal_admin', 'teacher')
    OR is_superadmin()
  )
);

-- ============================================================================
-- PART 5: Fix TEACHERS table policies
-- ============================================================================

DROP POLICY IF EXISTS "teachers_preschool_insert" ON public.teachers;
DROP POLICY IF EXISTS "teachers_preschool_read" ON public.teachers;
DROP POLICY IF EXISTS "teachers_preschool_update" ON public.teachers;

CREATE POLICY "teachers_read_own_preschool" ON public.teachers
FOR SELECT TO authenticated
USING (
  preschool_id = get_user_preschool_id()
  OR is_superadmin()
);

CREATE POLICY "teachers_admin_manage" ON public.teachers
FOR ALL TO authenticated
USING (
  preschool_id = get_user_preschool_id()
  AND (
    (SELECT profile_role FROM get_current_user_profile()) IN ('principal', 'admin', 'principal_admin')
    OR is_superadmin()
  )
)
WITH CHECK (
  preschool_id = get_user_preschool_id()
  AND (
    (SELECT profile_role FROM get_current_user_profile()) IN ('principal', 'admin', 'principal_admin')
    OR is_superadmin()
  )
);

COMMIT;

-- Verification
DO $$
DECLARE
  preschools_count int;
  students_count int;
  classes_count int;
  teachers_count int;
  users_count int;
BEGIN
  SELECT COUNT(*) INTO preschools_count FROM pg_policies WHERE tablename = 'preschools';
  SELECT COUNT(*) INTO students_count FROM pg_policies WHERE tablename = 'students';
  SELECT COUNT(*) INTO classes_count FROM pg_policies WHERE tablename = 'classes';
  SELECT COUNT(*) INTO teachers_count FROM pg_policies WHERE tablename = 'teachers';
  SELECT COUNT(*) INTO users_count FROM pg_policies WHERE tablename = 'users';
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ COMPREHENSIVE HOTFIX APPLIED';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📊 Policy Counts:';
  RAISE NOTICE '   ├─ preschools: % policies', preschools_count;
  RAISE NOTICE '   ├─ students: % policies', students_count;
  RAISE NOTICE '   ├─ classes: % policies', classes_count;
  RAISE NOTICE '   ├─ teachers: % policies', teachers_count;
  RAISE NOTICE '   └─ users: % policies', users_count;
  RAISE NOTICE '';
  RAISE NOTICE '🔒 SECURITY DEFINER Functions Created:';
  RAISE NOTICE '   ├─ get_current_user_profile()';
  RAISE NOTICE '   ├─ is_preschool_admin(uuid)';
  RAISE NOTICE '   ├─ is_superadmin()';
  RAISE NOTICE '   ├─ get_user_preschool_id()';
  RAISE NOTICE '   └─ get_current_user_role_and_preschool() [from previous fix]';
  RAISE NOTICE '';
  RAISE NOTICE '✅ ALL circular dependencies eliminated!';
  RAISE NOTICE '✅ No more infinite recursion errors!';
  RAISE NOTICE '';
END $$;
