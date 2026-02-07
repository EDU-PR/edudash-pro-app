-- =========================================================================
-- Migration: Fix profiles RLS infinite recursion
-- 
-- The previous migration (20260207034735) added a SELECT policy on
-- profiles that queries profiles itself, causing infinite recursion.
-- 
-- Fix: Drop the broken policy and create a helper function that uses
-- auth.jwt() to extract the user's org_id without querying profiles.
-- =========================================================================

-- 1. Drop the broken policy immediately
DROP POLICY IF EXISTS "Users can view profiles in same org" ON profiles;

-- 2. Create a SECURITY DEFINER helper that reads the current user's
--    org_id from their profile without triggering RLS.
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT COALESCE(organization_id, preschool_id)
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
$$;

-- 3. Re-create the policy using the helper function (no recursion)
CREATE POLICY "Users can view profiles in same org" ON profiles
    FOR SELECT
    USING (
        -- Own profile (always visible)
        id = auth.uid()
        -- Same org
        OR COALESCE(organization_id, preschool_id) = public.current_user_org_id()
        -- Super admin can see all
        OR (
            SELECT role FROM public.profiles WHERE id = auth.uid()
        ) = 'super_admin'
    );

-- NOTE: The super_admin subquery above also queries profiles, but it
-- only matches the row where id = auth.uid() (which is already allowed
-- by the first condition "id = auth.uid()"), so it won't recurse.
-- However, to be absolutely safe, let's use the JWT claim instead:

-- Drop and recreate with JWT-based super_admin check
DROP POLICY IF EXISTS "Users can view profiles in same org" ON profiles;

CREATE POLICY "Users can view profiles in same org" ON profiles
    FOR SELECT
    USING (
        -- Own profile
        id = auth.uid()
        -- Same organization
        OR COALESCE(organization_id, preschool_id) = public.current_user_org_id()
        -- Super admin bypass (check JWT metadata, no table query)
        OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super_admin')
    );
