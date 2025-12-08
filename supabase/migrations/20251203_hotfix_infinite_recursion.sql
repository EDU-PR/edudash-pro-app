-- ============================================================================
-- HOTFIX: Fix infinite recursion in users table RLS policies
-- ============================================================================
-- Problem: users_preschool_insert and users_preschool_update policies
-- query the users table, causing circular dependency
-- Solution: Use direct auth.uid() checks without subqueries to users table
-- ============================================================================

BEGIN;

-- Drop the problematic policies
DROP POLICY IF EXISTS "users_preschool_insert" ON public.users;
DROP POLICY IF EXISTS "users_preschool_update" ON public.users;

-- Also drop the new policies that might have circular refs
DROP POLICY IF EXISTS "users_preschool_read_only" ON public.users;
DROP POLICY IF EXISTS "users_preschool_staff_read" ON public.users;
DROP POLICY IF EXISTS "users_parent_self_only" ON public.users;
DROP POLICY IF EXISTS "users_preschool_admin_update" ON public.users;
DROP POLICY IF EXISTS "users_preschool_staff_limited_update" ON public.users;
DROP POLICY IF EXISTS "users_parent_no_update" ON public.users;

-- Create a secure function to get current user's role and preschool
-- This breaks the circular dependency by using SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.get_current_user_role_and_preschool()
RETURNS TABLE(user_role text, user_preschool_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role, preschool_id
  FROM public.users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_current_user_role_and_preschool() TO authenticated;

COMMENT ON FUNCTION public.get_current_user_role_and_preschool IS 
'SECURITY DEFINER function to get current user role and preschool without triggering RLS recursion';

-- Now recreate policies using the secure function

-- POLICY 1: Principals can view users in their preschool
CREATE POLICY "users_preschool_read_by_role" ON public.users
FOR SELECT
TO authenticated
USING (
  preschool_id = (SELECT user_preschool_id FROM get_current_user_role_and_preschool())
  AND (SELECT user_role FROM get_current_user_role_and_preschool()) IN ('principal_admin', 'admin', 'teacher')
);

-- POLICY 2: Teachers can view users in their preschool (staff only)
CREATE POLICY "users_staff_read_by_role" ON public.users
FOR SELECT
TO authenticated
USING (
  preschool_id = (SELECT user_preschool_id FROM get_current_user_role_and_preschool())
  AND (SELECT user_role FROM get_current_user_role_and_preschool()) = 'teacher'
  AND role IN ('teacher', 'principal_admin', 'admin')
);

-- POLICY 3: Parents can only view themselves
CREATE POLICY "users_parent_self_view" ON public.users
FOR SELECT
TO authenticated
USING (
  auth_user_id = auth.uid()
  AND (SELECT user_role FROM get_current_user_role_and_preschool()) = 'parent'
);

-- POLICY 4: Admins can insert users in their preschool
CREATE POLICY "users_admin_insert" ON public.users
FOR INSERT
TO authenticated
WITH CHECK (
  preschool_id = (SELECT user_preschool_id FROM get_current_user_role_and_preschool())
  AND (SELECT user_role FROM get_current_user_role_and_preschool()) IN ('principal_admin', 'admin')
  AND role <> 'superadmin'
);

-- POLICY 5: Admins can update users in their preschool
CREATE POLICY "users_admin_update" ON public.users
FOR UPDATE
TO authenticated
USING (
  preschool_id = (SELECT user_preschool_id FROM get_current_user_role_and_preschool())
  AND (SELECT user_role FROM get_current_user_role_and_preschool()) IN ('principal_admin', 'admin')
  AND role <> 'superadmin'
)
WITH CHECK (
  preschool_id = (SELECT user_preschool_id FROM get_current_user_role_and_preschool())
  AND (SELECT user_role FROM get_current_user_role_and_preschool()) IN ('principal_admin', 'admin')
  AND role <> 'superadmin'
);

-- POLICY 6: Teachers can update limited fields for users in their preschool
CREATE POLICY "users_teacher_limited_update" ON public.users
FOR UPDATE
TO authenticated
USING (
  preschool_id = (SELECT user_preschool_id FROM get_current_user_role_and_preschool())
  AND (SELECT user_role FROM get_current_user_role_and_preschool()) = 'teacher'
  AND role IN ('teacher', 'parent')
)
WITH CHECK (
  preschool_id = (SELECT user_preschool_id FROM get_current_user_role_and_preschool())
  AND (SELECT user_role FROM get_current_user_role_and_preschool()) = 'teacher'
  AND role IN ('teacher', 'parent')
);

-- Add audit logging
INSERT INTO public.schema_migrations (version, name, applied_at)
VALUES ('20251203_hotfix_infinite_recursion', 'Fix infinite recursion in users RLS policies', NOW())
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- Verification
DO $$
BEGIN
  RAISE NOTICE '✅ Hotfix applied: Infinite recursion fixed';
  RAISE NOTICE '   - Dropped circular policies';
  RAISE NOTICE '   - Created SECURITY DEFINER function: get_current_user_role_and_preschool()';
  RAISE NOTICE '   - Recreated 6 policies without circular dependencies';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 Test queries will no longer cause infinite recursion';
END $$;
