-- ============================================================================
-- Fix Infinite Recursion in Profiles RLS Policies
-- Date: 2025-12-26
-- Issue: The profiles_superadmin_update policy queries profiles table to check
--        if user is superadmin, which triggers RLS, causing infinite recursion.
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Create a SECURITY DEFINER function to check superadmin status
--         This bypasses RLS and prevents recursion
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_superadmin_safe()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  user_role text;
BEGIN
  -- Direct query without triggering RLS (SECURITY DEFINER)
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid();
  
  RETURN user_role IN ('superadmin', 'super_admin');
END;
$$;

COMMENT ON FUNCTION public.is_superadmin_safe() IS 
  'Check if current user is a super admin without triggering RLS (SECURITY DEFINER). Handles both superadmin and super_admin role variants.';

GRANT EXECUTE ON FUNCTION public.is_superadmin_safe() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin_safe() TO service_role;

-- ============================================================================
-- STEP 2: Drop problematic policies that cause recursion
-- ============================================================================

-- Drop the recursive profiles_superadmin_update policy
DROP POLICY IF EXISTS profiles_superadmin_update ON public.profiles;

-- Drop other potentially problematic policies
DROP POLICY IF EXISTS "profiles_org_access" ON public.profiles;

-- ============================================================================
-- STEP 3: Recreate superadmin update policy using the safe function
-- ============================================================================

CREATE POLICY profiles_superadmin_update ON public.profiles
FOR UPDATE TO authenticated
USING (
  is_superadmin_safe()
)
WITH CHECK (
  is_superadmin_safe()
);

COMMENT ON POLICY profiles_superadmin_update ON public.profiles IS 
  'Allow superadmin to update any profile using safe function to prevent recursion';

-- ============================================================================
-- STEP 4: Ensure superadmin can SELECT all profiles
-- ============================================================================

DROP POLICY IF EXISTS profiles_superadmin_read_all ON public.profiles;

CREATE POLICY profiles_superadmin_read_all ON public.profiles
FOR SELECT TO authenticated
USING (
  is_superadmin_safe()
);

COMMENT ON POLICY profiles_superadmin_read_all ON public.profiles IS 
  'Allow superadmin to read all profiles using safe function to prevent recursion';

-- ============================================================================
-- STEP 5: Fix subscriptions superadmin policy (also uses profiles)
-- ============================================================================

DROP POLICY IF EXISTS subscriptions_superadmin_read ON public.subscriptions;

CREATE POLICY subscriptions_superadmin_read ON public.subscriptions
FOR SELECT TO authenticated
USING (
  is_superadmin_safe()
);

COMMENT ON POLICY subscriptions_superadmin_read ON public.subscriptions IS 
  'Allow superadmin to read all subscriptions using safe function';

-- ============================================================================
-- STEP 6: Fix preschools superadmin policies
-- ============================================================================

DROP POLICY IF EXISTS preschools_superadmin_delete ON public.preschools;
DROP POLICY IF EXISTS preschools_superadmin_update ON public.preschools;
DROP POLICY IF EXISTS "preschools_superadmin_read_all" ON public.preschools;

CREATE POLICY preschools_superadmin_read_all ON public.preschools
FOR SELECT TO authenticated
USING (
  is_superadmin_safe()
);

CREATE POLICY preschools_superadmin_update ON public.preschools
FOR UPDATE TO authenticated
USING (
  is_superadmin_safe()
)
WITH CHECK (
  is_superadmin_safe()
);

CREATE POLICY preschools_superadmin_delete ON public.preschools
FOR DELETE TO authenticated
USING (
  is_superadmin_safe()
);

COMMENT ON POLICY preschools_superadmin_read_all ON public.preschools IS 'Allow superadmin to read all preschools';
COMMENT ON POLICY preschools_superadmin_update ON public.preschools IS 'Allow superadmin to update all preschools';
COMMENT ON POLICY preschools_superadmin_delete ON public.preschools IS 'Allow superadmin to delete preschools';

-- ============================================================================
-- STEP 7: Fix organizations superadmin policies
-- ============================================================================

DROP POLICY IF EXISTS organizations_superadmin_delete ON public.organizations;
DROP POLICY IF EXISTS organizations_superadmin_update ON public.organizations;

CREATE POLICY organizations_superadmin_read_all ON public.organizations
FOR SELECT TO authenticated
USING (
  is_superadmin_safe()
);

CREATE POLICY organizations_superadmin_update ON public.organizations
FOR UPDATE TO authenticated
USING (
  is_superadmin_safe()
)
WITH CHECK (
  is_superadmin_safe()
);

CREATE POLICY organizations_superadmin_delete ON public.organizations
FOR DELETE TO authenticated
USING (
  is_superadmin_safe()
);

-- ============================================================================
-- STEP 8: Fix schools superadmin policies
-- ============================================================================

DROP POLICY IF EXISTS schools_superadmin_delete ON public.schools;
DROP POLICY IF EXISTS schools_superadmin_update ON public.schools;
DROP POLICY IF EXISTS "schools_superadmin_read_all" ON public.schools;

CREATE POLICY schools_superadmin_read_all ON public.schools
FOR SELECT TO authenticated
USING (
  is_superadmin_safe()
);

CREATE POLICY schools_superadmin_update ON public.schools
FOR UPDATE TO authenticated
USING (
  is_superadmin_safe()
)
WITH CHECK (
  is_superadmin_safe()
);

CREATE POLICY schools_superadmin_delete ON public.schools
FOR DELETE TO authenticated
USING (
  is_superadmin_safe()
);

-- ============================================================================
-- STEP 9: Fix announcements superadmin policy
-- ============================================================================

DROP POLICY IF EXISTS announcements_superadmin_read ON public.announcements;

CREATE POLICY announcements_superadmin_read ON public.announcements
FOR SELECT TO authenticated
USING (
  is_superadmin_safe()
);

CREATE POLICY announcements_superadmin_manage ON public.announcements
FOR ALL TO authenticated
USING (
  is_superadmin_safe()
)
WITH CHECK (
  is_superadmin_safe()
);

-- ============================================================================
-- STEP 10: Also update the is_superadmin() function to use the safe method
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  -- Use subquery to avoid RLS recursion
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('superadmin', 'super_admin')
  );
$$;

-- ============================================================================
-- STEP 11: Log migration completion
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ FIXED INFINITE RECURSION IN PROFILES RLS';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Created is_superadmin_safe() SECURITY DEFINER function';
  RAISE NOTICE 'Recreated all superadmin policies using safe function';
  RAISE NOTICE 'Fixed tables: profiles, preschools, schools, organizations, subscriptions, announcements';
END;
$$;

COMMIT;
