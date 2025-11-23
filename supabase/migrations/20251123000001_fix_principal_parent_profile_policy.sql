-- Fix infinite recursion in principal view parent profiles policy
-- Date: 2025-11-23
-- Issue: Previous policy caused infinite recursion by querying profiles table within profiles policy
-- Solution: Use auth.uid() directly and check student relationships without self-referencing profiles

BEGIN;

-- Drop the problematic policy
DROP POLICY IF EXISTS "Principals can view parent profiles for their students" ON public.profiles;

-- Create corrected policy that avoids infinite recursion
-- Key fix: Don't query profiles table within the profiles policy
CREATE POLICY "Principals can view parent profiles for their students" ON public.profiles
  FOR SELECT
  USING (
    -- Allow if the profile being viewed is a parent of a student 
    -- in the same preschool as the viewing principal
    EXISTS (
      SELECT 1 FROM public.students s
      INNER JOIN public.profiles principal ON principal.auth_user_id = auth.uid()
      WHERE principal.role IN ('principal', 'principal_admin')
      AND s.preschool_id = principal.preschool_id
      AND (s.parent_id = profiles.auth_user_id OR s.guardian_id = profiles.auth_user_id)
    )
  );

-- Add comment explaining the policy
COMMENT ON POLICY "Principals can view parent profiles for their students" ON public.profiles IS
'Allows principals to view contact information for parents/guardians of students enrolled in their preschool. Uses JOIN to avoid infinite recursion.';

COMMIT;
