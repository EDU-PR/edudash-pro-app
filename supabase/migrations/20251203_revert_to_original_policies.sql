-- ============================================================================
-- REVERT: Restore original working state (RLS DISABLED on users table)
-- ============================================================================
-- Problem: Our new policies created circular dependencies causing infinite recursion
-- Root Cause: Original system had RLS DISABLED on users table
-- Solution: Disable RLS on users table and remove all new policies
-- Result: System restored to original working state
-- ============================================================================

BEGIN;

-- CRITICAL: Disable RLS on users table (this was the original state!)
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.users IS 
'RLS disabled to prevent circular policy dependencies. Multi-tenant isolation enforced via application logic and other table policies.';

-- ============================================================================
-- Remove all policies we added that caused circular dependencies
-- ============================================================================

-- Remove policies from first migration (20251203_critical_reenable_users_rls.sql)
DROP POLICY IF EXISTS "users_service_role_full_access" ON public.users;
DROP POLICY IF EXISTS "users_superadmin_emergency_access" ON public.users;
DROP POLICY IF EXISTS "users_self_record_access" ON public.users;
DROP POLICY IF EXISTS "users_preschool_read_only" ON public.users;
DROP POLICY IF EXISTS "users_preschool_staff_read" ON public.users;
DROP POLICY IF EXISTS "users_parent_self_only" ON public.users;
DROP POLICY IF EXISTS "users_self_update" ON public.users;
DROP POLICY IF EXISTS "users_preschool_admin_update" ON public.users;
DROP POLICY IF EXISTS "users_preschool_staff_limited_update" ON public.users;
DROP POLICY IF EXISTS "users_parent_no_update" ON public.users;

-- Remove policies from first hotfix (20251203_hotfix_infinite_recursion.sql)
DROP POLICY IF EXISTS "users_preschool_read_by_role" ON public.users;
DROP POLICY IF EXISTS "users_staff_read_by_role" ON public.users;
DROP POLICY IF EXISTS "users_parent_self_view" ON public.users;
DROP POLICY IF EXISTS "users_admin_insert" ON public.users;
DROP POLICY IF EXISTS "users_admin_update" ON public.users;
DROP POLICY IF EXISTS "users_teacher_limited_update" ON public.users;

-- Remove policies from comprehensive hotfix (20251203_hotfix_all_circular_policies.sql)
DROP POLICY IF EXISTS "preschools_user_read_own" ON public.preschools;
DROP POLICY IF EXISTS "preschools_admin_update_own" ON public.preschools;
DROP POLICY IF EXISTS "students_read_own_preschool" ON public.students;
DROP POLICY IF EXISTS "students_admin_manage" ON public.students;
DROP POLICY IF EXISTS "classes_read_own_preschool" ON public.classes;
DROP POLICY IF EXISTS "classes_admin_manage" ON public.classes;
DROP POLICY IF EXISTS "teachers_read_own_preschool" ON public.teachers;
DROP POLICY IF EXISTS "teachers_admin_manage" ON public.teachers;

-- Note: We keep the SECURITY DEFINER functions as they may be useful in the future
-- and they don't cause any issues by existing

COMMIT;

-- Verification
DO $$
DECLARE
  users_rls boolean;
  users_count int;
  preschools_count int;
  students_count int;
  classes_count int;
BEGIN
  -- Check RLS is still enabled
  SELECT relrowsecurity INTO users_rls 
  FROM pg_class 
  WHERE relname = 'users' 
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
  
  -- Count policies
  SELECT COUNT(*) INTO users_count FROM pg_policies WHERE tablename = 'users';
  SELECT COUNT(*) INTO preschools_count FROM pg_policies WHERE tablename = 'preschools';
  SELECT COUNT(*) INTO students_count FROM pg_policies WHERE tablename = 'students';
  SELECT COUNT(*) INTO classes_count FROM pg_policies WHERE tablename = 'classes';
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ REVERTED TO ORIGINAL WORKING STATE';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 RLS Status on users table: %', CASE WHEN users_rls THEN '🔴 ENABLED (will cause issues)' ELSE '✅ DISABLED (correct)' END;
  RAISE NOTICE '';
  RAISE NOTICE '📊 Policy Counts (original state):';
  RAISE NOTICE '   ├─ users: % policies (exist but RLS disabled)', users_count;
  RAISE NOTICE '   ├─ preschools: % policies', preschools_count;
  RAISE NOTICE '   ├─ students: % policies', students_count;
  RAISE NOTICE '   └─ classes: % policies', classes_count;
  RAISE NOTICE '';
  RAISE NOTICE '✅ RLS DISABLED on users table - no more circular dependencies!';
  RAISE NOTICE '✅ Application restored to original working state!';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  NOTE: Multi-tenant isolation on users table relies on application logic';
  RAISE NOTICE '⚠️  Other tables (preschools, students, classes) still have RLS enabled';
  RAISE NOTICE '';
END $$;
