-- Fix RLS recursion by using security definer function
-- Date: 2025-11-23
-- Issue: Circular RLS checks between profiles and preschools tables
-- Solution: Create a function that bypasses RLS to check principal status

BEGIN;

-- Drop the problematic policy first
DROP POLICY IF EXISTS "Principals can view parent profiles for their students" ON public.profiles;

-- Create a security definer function to check if current user is a principal
-- This bypasses RLS policies and prevents infinite recursion
CREATE OR REPLACE FUNCTION public.is_principal_of_preschool(target_preschool_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE auth_user_id = auth.uid()
    AND role IN ('principal', 'principal_admin')
    AND preschool_id = target_preschool_id
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_principal_of_preschool(uuid) TO authenticated;

-- Create corrected policy using the security definer function
CREATE POLICY "Principals can view parent profiles for their students" ON public.profiles
  FOR SELECT
  USING (
    -- Allow if the profile being viewed is a parent of a student 
    -- whose principal is the current user
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE (s.parent_id = profiles.auth_user_id OR s.guardian_id = profiles.auth_user_id)
      AND public.is_principal_of_preschool(s.preschool_id)
    )
  );

-- Add comment
COMMENT ON FUNCTION public.is_principal_of_preschool(uuid) IS
'Security definer function to check if current user is principal of given preschool. Prevents RLS recursion.';

COMMENT ON POLICY "Principals can view parent profiles for their students" ON public.profiles IS
'Allows principals to view parent profiles using security definer function to avoid RLS recursion.';

COMMIT;
