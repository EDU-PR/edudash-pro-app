-- Fix principal parent profile view without recursion
-- Date: 2025-11-23
-- Issue: RLS policies causing infinite recursion
-- Solution: Use a completely different approach with a materialized join table or bypass via function

BEGIN;

-- Drop existing function and policy
DROP POLICY IF EXISTS "Principals can view parent profiles for their students" ON public.profiles;
DROP FUNCTION IF EXISTS public.is_principal_of_preschool(uuid);

-- Create a function that returns parent profile IDs that a principal can view
-- This runs as SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION public.get_viewable_parent_ids_for_principal()
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  principal_preschool_id uuid;
BEGIN
  -- Get the principal's preschool_id
  SELECT preschool_id INTO principal_preschool_id
  FROM public.profiles
  WHERE auth_user_id = auth.uid()
  AND role IN ('principal', 'principal_admin')
  LIMIT 1;
  
  -- If not a principal, return empty set
  IF principal_preschool_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Return all parent/guardian profile IDs for students in this preschool
  RETURN QUERY
  SELECT DISTINCT parent_id
  FROM public.students
  WHERE preschool_id = principal_preschool_id
  AND parent_id IS NOT NULL
  
  UNION
  
  SELECT DISTINCT guardian_id
  FROM public.students
  WHERE preschool_id = principal_preschool_id
  AND guardian_id IS NOT NULL;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_viewable_parent_ids_for_principal() TO authenticated;

-- Create the policy using the function
CREATE POLICY "Principals can view parent profiles for their students" ON public.profiles
  FOR SELECT
  USING (
    -- Allow if this profile ID is in the list of viewable parents
    id IN (SELECT public.get_viewable_parent_ids_for_principal())
  );

-- Add comments
COMMENT ON FUNCTION public.get_viewable_parent_ids_for_principal() IS
'Returns profile IDs of parents/guardians that the current principal can view. Uses SECURITY DEFINER to avoid RLS recursion.';

COMMENT ON POLICY "Principals can view parent profiles for their students" ON public.profiles IS
'Allows principals to view parent/guardian profiles for students in their preschool. Uses security definer function to prevent recursion.';

COMMIT;
