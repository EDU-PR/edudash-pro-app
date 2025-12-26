-- Fix is_superadmin function to handle both 'superadmin' and 'super_admin' role variants
-- Date: 2025-12-26
-- Issue: RLS policies using is_superadmin() fail for users with either role variant

BEGIN;

-- ============================================================================
-- UPDATE is_superadmin() to check both role variants
-- ============================================================================

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
    AND role IN ('superadmin', 'super_admin')
  );
$$;

COMMENT ON FUNCTION public.is_superadmin() IS 
  'Check if current user is a super admin. Handles both superadmin and super_admin role variants.';

-- ============================================================================
-- Also update app_auth.is_superadmin if it exists
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_schema = 'app_auth' 
    AND routine_name = 'is_superadmin'
  ) THEN
    EXECUTE $func$
      CREATE OR REPLACE FUNCTION app_auth.is_superadmin()
      RETURNS boolean
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public
      STABLE
      AS $inner$
        SELECT EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role IN ('superadmin', 'super_admin')
        );
      $inner$;
    $func$;
  END IF;
END;
$$;

-- ============================================================================
-- Ensure super admins can read ALL preschools (not just their own)
-- ============================================================================

-- Drop and recreate the preschools read policy to be more permissive for superadmins
DROP POLICY IF EXISTS "preschools_user_read_own" ON public.preschools;
DROP POLICY IF EXISTS "preschools_superadmin_read_all" ON public.preschools;

-- Policy: Super admins can read ALL preschools
CREATE POLICY "preschools_superadmin_read_all" ON public.preschools
FOR SELECT TO authenticated
USING (
  is_superadmin()
);

-- Policy: Regular users can read their own preschool
CREATE POLICY "preschools_user_read_own" ON public.preschools
FOR SELECT TO authenticated
USING (
  id = get_user_preschool_id()
);

-- ============================================================================
-- Also ensure schools table has superadmin read access
-- ============================================================================

DROP POLICY IF EXISTS "schools_superadmin_read_all" ON public.schools;

CREATE POLICY "schools_superadmin_read_all" ON public.schools
FOR SELECT TO authenticated
USING (
  is_superadmin()
);

-- ============================================================================
-- Log migration completion
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'is_superadmin() function updated to handle both role variants';
  RAISE NOTICE 'preschools and schools read policies updated for superadmin access';
END;
$$;

COMMIT;
