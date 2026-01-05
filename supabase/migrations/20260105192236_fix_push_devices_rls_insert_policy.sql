-- Fix push_devices RLS INSERT policy
-- 
-- Problem: The push_devices_rls_write policy (from 20250919140421_remaining_table_policies.sql)
-- references a non-existent 'users' table (should be 'profiles'), causing 403 errors on INSERT.
--
-- Solution: Drop the broken policies and restore simple, working policies that match auth.uid()
-- directly against the user_id column (which stores auth.users.id, not profiles.id).

-- First, drop the broken complex policies
DROP POLICY IF EXISTS push_devices_rls_read ON public.push_devices;
DROP POLICY IF EXISTS push_devices_rls_write ON public.push_devices;

-- Also ensure any original policies are dropped to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own push devices" ON public.push_devices;
DROP POLICY IF EXISTS "Users can insert their own push devices" ON public.push_devices;
DROP POLICY IF EXISTS "Users can update their own push devices" ON public.push_devices;
DROP POLICY IF EXISTS "Users can delete their own push devices" ON public.push_devices;
DROP POLICY IF EXISTS "Service role can manage all push devices" ON public.push_devices;

-- Ensure RLS is enabled
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;

-- Create simple, working policies that reference auth.uid() directly
-- The push_devices.user_id column stores the auth.users.id (UUID), so we match against auth.uid()

-- SELECT: Users can view their own push devices
CREATE POLICY "push_devices_select_own" ON public.push_devices
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- INSERT: Users can insert their own push devices
-- This is the critical fix - the WITH CHECK clause now correctly validates user_id = auth.uid()
CREATE POLICY "push_devices_insert_own" ON public.push_devices
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- UPDATE: Users can update their own push devices
CREATE POLICY "push_devices_update_own" ON public.push_devices
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- DELETE: Users can delete their own push devices
CREATE POLICY "push_devices_delete_own" ON public.push_devices
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Service role bypass for admin operations and push notification dispatching
CREATE POLICY "push_devices_service_role" ON public.push_devices
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- SuperAdmin bypass for support and debugging
CREATE POLICY "push_devices_superadmin_bypass" ON public.push_devices
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('super_admin', 'superadmin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('super_admin', 'superadmin')
  )
);

-- Ensure permissions are correct
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_devices TO authenticated;
GRANT ALL ON public.push_devices TO service_role;

-- Add descriptive comment
COMMENT ON TABLE public.push_devices IS 
'Stores push notification device registrations for users. 
RLS policies ensure users can only manage their own devices.
Service role is used by notifications-dispatcher edge function.';
