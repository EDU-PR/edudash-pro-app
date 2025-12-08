-- ============================================================================
-- CRITICAL SECURITY FIX: Re-enable RLS on users table
-- ============================================================================
-- Issue: RLS was temporarily disabled for diagnostics but never re-enabled
-- Risk: Complete multi-tenant isolation breakdown
-- Priority: CRITICAL
-- Date: 2025-12-03
-- ============================================================================

-- Log the re-enablement
DO $$ 
BEGIN 
    RAISE NOTICE '🔒 CRITICAL FIX: Re-enabling RLS on users table';
    RAISE NOTICE '✅ Restoring multi-tenant security isolation';
END $$;

-- Re-enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Update table comment
COMMENT ON TABLE public.users IS 'User accounts with proper RLS enabled for multi-tenant isolation';

-- ============================================================================
-- Create comprehensive RLS policies for users table
-- ============================================================================

-- Drop old temporary policies
DROP POLICY IF EXISTS users_service_role_full_access ON public.users;
DROP POLICY IF EXISTS users_superadmin_emergency_access ON public.users;
DROP POLICY IF EXISTS users_self_record_access ON public.users;
DROP POLICY IF EXISTS users_preschool_read_only ON public.users;

-- Policy 1: Users can view their own record
CREATE POLICY "users_self_access" ON public.users
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- Policy 2: Users can update their own non-sensitive fields
CREATE POLICY "users_self_update" ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (
    auth_user_id = auth.uid() AND
    -- Prevent role escalation
    role = (SELECT role FROM public.users WHERE auth_user_id = auth.uid())
  );

-- Policy 3: Superadmins can view all users
CREATE POLICY "users_superadmin_select" ON public.users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users AS u
      WHERE u.auth_user_id = auth.uid()
      AND u.role = 'superadmin'
    )
  );

-- Policy 4: Superadmins can update all users (except role changes require extra validation)
CREATE POLICY "users_superadmin_update" ON public.users
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users AS u
      WHERE u.auth_user_id = auth.uid()
      AND u.role = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users AS u
      WHERE u.auth_user_id = auth.uid()
      AND u.role = 'superadmin'
    )
  );

-- Policy 5: Principals/Admins can view users in their preschool
CREATE POLICY "users_preschool_view" ON public.users
  FOR SELECT
  TO authenticated
  USING (
    preschool_id IN (
      SELECT preschool_id FROM public.users
      WHERE auth_user_id = auth.uid()
      AND role IN ('principal_admin', 'admin')
    )
  );

-- Policy 6: Principals can update users in their preschool (except superadmins)
CREATE POLICY "users_preschool_update" ON public.users
  FOR UPDATE
  TO authenticated
  USING (
    preschool_id IN (
      SELECT preschool_id FROM public.users
      WHERE auth_user_id = auth.uid()
      AND role IN ('principal_admin', 'admin')
    )
    AND role != 'superadmin' -- Cannot modify superadmins
  )
  WITH CHECK (
    preschool_id IN (
      SELECT preschool_id FROM public.users
      WHERE auth_user_id = auth.uid()
      AND role IN ('principal_admin', 'admin')
    )
    AND role != 'superadmin'
    -- Prevent role escalation to superadmin
    AND role IN ('teacher', 'parent', 'student', 'admin', 'principal_admin')
  );

-- Policy 7: Allow user creation (signup)
CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

-- Policy 8: Superadmins can insert any user
CREATE POLICY "users_superadmin_insert" ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users AS u
      WHERE u.auth_user_id = auth.uid()
      AND u.role = 'superadmin'
    )
  );

-- Policy 9: Principals can insert users in their preschool
CREATE POLICY "users_preschool_insert" ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    preschool_id IN (
      SELECT preschool_id FROM public.users
      WHERE auth_user_id = auth.uid()
      AND role IN ('principal_admin', 'admin')
    )
    AND role != 'superadmin' -- Cannot create superadmins
  );

-- Policy 10: Superadmins can delete users
CREATE POLICY "users_superadmin_delete" ON public.users
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users AS u
      WHERE u.auth_user_id = auth.uid()
      AND u.role = 'superadmin'
    )
  );

-- ============================================================================
-- Update tracking config
-- ============================================================================

-- Update or insert tracking record
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'users_rls_restored',
  jsonb_build_object(
    'restored_at', now(),
    'migration', '20251203_critical_reenable_users_rls',
    'status', 'SECURE',
    'policies_count', 10
  ),
  'RLS re-enabled on users table with comprehensive policies',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = jsonb_build_object(
    'restored_at', now(),
    'migration', '20251203_critical_reenable_users_rls',
    'status', 'SECURE',
    'policies_count', 10
  ),
  updated_at = now();

-- Remove old temporary tracking
DELETE FROM public.config_kv WHERE key = 'users_rls_temporary_disabled';

-- ============================================================================
-- Verify RLS is enabled
-- ============================================================================

DO $$ 
DECLARE
  rls_enabled boolean;
  policy_count int;
BEGIN 
  -- Check if RLS is enabled
  SELECT relrowsecurity INTO rls_enabled
  FROM pg_class
  WHERE relname = 'users' AND relnamespace = 'public'::regnamespace;
  
  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'users' AND schemaname = 'public';
  
  IF rls_enabled THEN
    RAISE NOTICE '✅ RLS is now ENABLED on users table';
    RAISE NOTICE '✅ Total policies: %', policy_count;
    RAISE NOTICE '🔒 Multi-tenant isolation restored';
  ELSE
    RAISE EXCEPTION '❌ CRITICAL: RLS still disabled!';
  END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Changes:
-- - Re-enabled RLS on users table
-- - Created 10 comprehensive policies covering:
--   * Self-access (view/update own record)
--   * Superadmin access (full control)
--   * Preschool admin access (tenant isolation)
--   * User creation (signup, admin invites)
--   * Role protection (prevent escalation)
-- - Updated tracking metadata
-- - Verified RLS is active
-- ============================================================================
