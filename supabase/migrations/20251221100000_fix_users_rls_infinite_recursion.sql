-- ============================================================================
-- CRITICAL FIX: Resolve infinite recursion in users table RLS policies
-- ============================================================================
-- Issue: RLS policies on users table contain subqueries that reference the
--        users table itself, causing PostgreSQL error 42P17:
--        "infinite recursion detected in policy for relation 'users'"
-- 
-- Solution: Use SECURITY DEFINER functions that bypass RLS to get current
--           user context, avoiding the circular dependency
-- 
-- Date: 2025-12-21
-- Priority: CRITICAL - App is broken without this fix
-- ============================================================================

BEGIN;

-- Log start
DO $$ 
BEGIN 
    RAISE NOTICE '🔧 Starting critical fix for users table RLS infinite recursion...';
END $$;

-- ============================================================================
-- STEP 1: Drop ALL existing policies on users table to start fresh
-- ============================================================================

-- Drop policies from 20251203_critical_reenable_users_rls.sql (the problematic ones)
DROP POLICY IF EXISTS "users_self_access" ON public.users;
DROP POLICY IF EXISTS "users_self_update" ON public.users;
DROP POLICY IF EXISTS "users_superadmin_select" ON public.users;
DROP POLICY IF EXISTS "users_superadmin_update" ON public.users;
DROP POLICY IF EXISTS "users_preschool_view" ON public.users;
DROP POLICY IF EXISTS "users_preschool_update" ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "users_superadmin_insert" ON public.users;
DROP POLICY IF EXISTS "users_preschool_insert" ON public.users;
DROP POLICY IF EXISTS "users_superadmin_delete" ON public.users;

-- Drop policies from 20251203_hotfix_infinite_recursion.sql
DROP POLICY IF EXISTS "users_preschool_read_by_role" ON public.users;
DROP POLICY IF EXISTS "users_staff_read_by_role" ON public.users;
DROP POLICY IF EXISTS "users_parent_self_view" ON public.users;
DROP POLICY IF EXISTS "users_admin_insert" ON public.users;
DROP POLICY IF EXISTS "users_admin_update" ON public.users;
DROP POLICY IF EXISTS "users_teacher_limited_update" ON public.users;

-- Drop any other legacy policies that might exist
DROP POLICY IF EXISTS users_superadmin_access ON public.users;
DROP POLICY IF EXISTS users_self_access ON public.users;
DROP POLICY IF EXISTS users_tenant_admin_access ON public.users;
DROP POLICY IF EXISTS users_tenant_visibility ON public.users;
DROP POLICY IF EXISTS users_superadmin_authenticated_access ON public.users;
DROP POLICY IF EXISTS users_service_role_full_access ON public.users;
DROP POLICY IF EXISTS users_superadmin_emergency_access ON public.users;
DROP POLICY IF EXISTS users_self_record_access ON public.users;
DROP POLICY IF EXISTS users_preschool_read_only ON public.users;
DROP POLICY IF EXISTS users_service_role_access ON public.users;
DROP POLICY IF EXISTS users_superadmin_direct_access ON public.users;
DROP POLICY IF EXISTS users_own_record_access ON public.users;
DROP POLICY IF EXISTS users_basic_org_read ON public.users;
DROP POLICY IF EXISTS users_admin_via_profiles ON public.users;
DROP POLICY IF EXISTS users_rls_write ON public.users;
DROP POLICY IF EXISTS users_rls_read ON public.users;
DROP POLICY IF EXISTS users_own_data ON public.users;
DROP POLICY IF EXISTS users_own_profile_access ON public.users;
DROP POLICY IF EXISTS users_principal_management ON public.users;
DROP POLICY IF EXISTS users_teacher_view_colleagues ON public.users;
DROP POLICY IF EXISTS users_superadmin_full_access ON public.users;
DROP POLICY IF EXISTS users_own_profile ON public.users;
DROP POLICY IF EXISTS users_principal_organization_access ON public.users;
DROP POLICY IF EXISTS users_teacher_colleague_view ON public.users;

DO $$ 
BEGIN 
    RAISE NOTICE '✅ Dropped all existing policies on users table';
END $$;

-- ============================================================================
-- STEP 2: Create/Update SECURITY DEFINER function to get user context
-- This function bypasses RLS, preventing infinite recursion
-- ============================================================================

-- Drop the old function if it exists with different signature
DROP FUNCTION IF EXISTS public.get_current_user_role_and_preschool();
DROP FUNCTION IF EXISTS public.get_my_user_context();

-- Create the helper function with SECURITY DEFINER
-- This runs with the privileges of the function owner (postgres), bypassing RLS
CREATE OR REPLACE FUNCTION public.get_my_user_context()
RETURNS TABLE(
  user_id uuid,
  user_auth_user_id uuid,
  user_role text,
  user_preschool_id uuid,
  is_superadmin boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT 
    id,
    auth_user_id,
    role,
    preschool_id,
    role = 'superadmin'
  FROM public.users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_user_context() TO authenticated;

COMMENT ON FUNCTION public.get_my_user_context() IS 
'SECURITY DEFINER function to get current user context without triggering RLS recursion. Returns user_id, auth_user_id, role, preschool_id, and is_superadmin flag.';

DO $$ 
BEGIN 
    RAISE NOTICE '✅ Created SECURITY DEFINER function: get_my_user_context()';
END $$;

-- ============================================================================
-- STEP 3: Create new non-recursive RLS policies
-- All policies use get_my_user_context() instead of direct subqueries
-- ============================================================================

-- Ensure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owner too (important for security)
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

-- POLICY 1: Users can SELECT their own record
-- Simple auth.uid() check - no subquery needed
CREATE POLICY users_select_own ON public.users
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- POLICY 2: Users can UPDATE their own record (except role)
CREATE POLICY users_update_own ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (
    auth_user_id = auth.uid()
    -- Use the function to check role hasn't changed
    AND role = (SELECT user_role FROM get_my_user_context())
  );

-- POLICY 3: Superadmins can SELECT all users
CREATE POLICY users_superadmin_select ON public.users
  FOR SELECT
  TO authenticated
  USING (
    (SELECT is_superadmin FROM get_my_user_context()) = true
  );

-- POLICY 4: Superadmins can UPDATE all users
CREATE POLICY users_superadmin_update ON public.users
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT is_superadmin FROM get_my_user_context()) = true
  )
  WITH CHECK (
    (SELECT is_superadmin FROM get_my_user_context()) = true
  );

-- POLICY 5: Superadmins can INSERT any user
CREATE POLICY users_superadmin_insert ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT is_superadmin FROM get_my_user_context()) = true
  );

-- POLICY 6: Superadmins can DELETE users
CREATE POLICY users_superadmin_delete ON public.users
  FOR DELETE
  TO authenticated
  USING (
    (SELECT is_superadmin FROM get_my_user_context()) = true
  );

-- POLICY 7: Principals/Admins can SELECT users in their preschool
CREATE POLICY users_admin_select_preschool ON public.users
  FOR SELECT
  TO authenticated
  USING (
    preschool_id = (SELECT user_preschool_id FROM get_my_user_context())
    AND (SELECT user_role FROM get_my_user_context()) IN ('principal_admin', 'admin', 'principal')
  );

-- POLICY 8: Principals can UPDATE users in their preschool (except superadmins)
CREATE POLICY users_admin_update_preschool ON public.users
  FOR UPDATE
  TO authenticated
  USING (
    preschool_id = (SELECT user_preschool_id FROM get_my_user_context())
    AND (SELECT user_role FROM get_my_user_context()) IN ('principal_admin', 'admin', 'principal')
    AND role != 'superadmin'
  )
  WITH CHECK (
    preschool_id = (SELECT user_preschool_id FROM get_my_user_context())
    AND (SELECT user_role FROM get_my_user_context()) IN ('principal_admin', 'admin', 'principal')
    AND role != 'superadmin'
  );

-- POLICY 9: Principals can INSERT users in their preschool
CREATE POLICY users_admin_insert_preschool ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    preschool_id = (SELECT user_preschool_id FROM get_my_user_context())
    AND (SELECT user_role FROM get_my_user_context()) IN ('principal_admin', 'admin', 'principal')
    AND role != 'superadmin'
  );

-- POLICY 10: Teachers can SELECT colleagues in their preschool (staff only)
CREATE POLICY users_teacher_view_staff ON public.users
  FOR SELECT
  TO authenticated
  USING (
    preschool_id = (SELECT user_preschool_id FROM get_my_user_context())
    AND (SELECT user_role FROM get_my_user_context()) = 'teacher'
    AND role IN ('teacher', 'principal_admin', 'admin', 'principal')
  );

-- POLICY 11: Users can INSERT their own record (for signup)
-- This is needed for the initial user creation
CREATE POLICY users_insert_self ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

-- POLICY 12: Service role has full access (for backend operations)
-- Note: service_role already bypasses RLS by default, but explicit is better
CREATE POLICY users_service_role_all ON public.users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DO $$ 
BEGIN 
    RAISE NOTICE '✅ Created 12 new non-recursive RLS policies';
END $$;

-- ============================================================================
-- STEP 4: Also fix profiles table policy that might cause issues
-- ============================================================================

-- Drop the problematic principal policy that references profiles in a loop
DROP POLICY IF EXISTS "Principals can view parent profiles for their students" ON public.profiles;

-- The function get_viewable_parent_ids_for_principal() also needs fixing
-- It queries profiles table which triggers RLS which calls the function again
DROP FUNCTION IF EXISTS public.get_viewable_parent_ids_for_principal();

-- Recreate without the recursive profile lookup in the function itself
CREATE OR REPLACE FUNCTION public.get_viewable_parent_ids_for_principal()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  -- Get parent IDs using the users table (via our safe function) instead of profiles
  SELECT DISTINCT parent_id
  FROM public.students
  WHERE preschool_id = (SELECT user_preschool_id FROM get_my_user_context())
    AND (SELECT user_role FROM get_my_user_context()) IN ('principal', 'principal_admin', 'admin')
    AND parent_id IS NOT NULL
  
  UNION
  
  SELECT DISTINCT guardian_id
  FROM public.students
  WHERE preschool_id = (SELECT user_preschool_id FROM get_my_user_context())
    AND (SELECT user_role FROM get_my_user_context()) IN ('principal', 'principal_admin', 'admin')
    AND guardian_id IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_viewable_parent_ids_for_principal() TO authenticated;

-- Recreate the policy safely
CREATE POLICY profiles_principal_view_parents ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT public.get_viewable_parent_ids_for_principal())
  );

DO $$ 
BEGIN 
    RAISE NOTICE '✅ Fixed profiles table principal view policy';
END $$;

-- ============================================================================
-- STEP 5: Update tracking and verify
-- ============================================================================

-- Update tracking record
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'users_rls_recursion_fix',
  jsonb_build_object(
    'fixed_at', now(),
    'migration', '20251221100000_fix_users_rls_infinite_recursion',
    'status', 'FIXED',
    'policies_count', 12,
    'method', 'SECURITY_DEFINER_function'
  ),
  'Fixed infinite recursion in users table RLS policies',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = jsonb_build_object(
    'fixed_at', now(),
    'migration', '20251221100000_fix_users_rls_infinite_recursion',
    'status', 'FIXED',
    'policies_count', 12,
    'method', 'SECURITY_DEFINER_function'
  ),
  updated_at = now();

-- Verify policies were created
DO $$ 
DECLARE
  policy_count int;
  rls_enabled boolean;
BEGIN 
  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'users' AND schemaname = 'public';
  
  -- Check RLS status
  SELECT relrowsecurity INTO rls_enabled
  FROM pg_class
  WHERE relname = 'users' AND relnamespace = 'public'::regnamespace;
  
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ CRITICAL FIX COMPLETE';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'RLS enabled: %', rls_enabled;
  RAISE NOTICE 'Policy count: %', policy_count;
  RAISE NOTICE '';
  RAISE NOTICE 'The infinite recursion issue has been fixed by:';
  RAISE NOTICE '1. Dropping all self-referencing policies';
  RAISE NOTICE '2. Creating get_my_user_context() SECURITY DEFINER function';
  RAISE NOTICE '3. Recreating policies using the safe function';
  RAISE NOTICE '================================================';
END $$;

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- This migration fixes PostgreSQL error 42P17:
-- "infinite recursion detected in policy for relation 'users'"
--
-- The fix uses a SECURITY DEFINER function that bypasses RLS to get
-- the current user's context (role, preschool_id) without triggering
-- the policies on the users table itself.
-- ============================================================================
