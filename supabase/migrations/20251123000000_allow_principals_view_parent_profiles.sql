-- Allow principals to view parent profiles for students in their preschool
-- Date: 2025-11-23
-- Issue: Guardian Information card not showing because RLS blocks parent profile access
-- Context: Principals need to see parent contact info for students in their school

BEGIN;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Principals can view parent profiles for their students" ON public.profiles;

-- Create policy allowing principals to view parent profiles
-- This works by checking if the parent's profile.id matches any student.parent_id or student.guardian_id
-- for students in the principal's preschool
CREATE POLICY "Principals can view parent profiles for their students" ON public.profiles
  FOR SELECT
  USING (
    -- Allow if the viewing user is a principal
    EXISTS (
      SELECT 1 FROM public.profiles viewer
      WHERE viewer.id = auth.uid()
      AND viewer.role IN ('principal', 'principal_admin')
      AND viewer.preschool_id IS NOT NULL
      -- And the profile being viewed is a parent of a student in that preschool
      AND EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.preschool_id = viewer.preschool_id
        AND (s.parent_id = profiles.id OR s.guardian_id = profiles.id)
      )
    )
  );

-- Add comment explaining the policy
COMMENT ON POLICY "Principals can view parent profiles for their students" ON public.profiles IS
'Allows principals to view contact information for parents/guardians of students enrolled in their preschool. Required for displaying guardian information on student detail pages.';

COMMIT;
