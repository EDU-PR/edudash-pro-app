-- Fix Enrollment RLS Policy - Use Function-Based Approach
-- Date: 2025-12-19
-- Purpose: Use a function to check enrollment_method since WITH CHECK clauses
--          may not reliably access the row being inserted

BEGIN;

-- Create a helper function to check if enrollment should be allowed
CREATE OR REPLACE FUNCTION public.can_self_enroll_in_course(
  p_course_id UUID,
  p_enrollment_method TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course RECORD;
  v_user_org_id UUID;
  v_profile_exists BOOLEAN;
BEGIN
  -- Get course info
  SELECT id, organization_id, is_active, deleted_at
  INTO v_course
  FROM courses
  WHERE id = p_course_id
  LIMIT 1;

  -- Course must exist, be active, and not deleted
  IF NOT FOUND OR NOT v_course.is_active OR v_course.deleted_at IS NOT NULL THEN
    RETURN FALSE;
  END IF;

  -- PRIORITY 1: If enrollment_method is 'join_code', always allow (program code authorization)
  IF p_enrollment_method = 'join_code' THEN
    RETURN TRUE;
  END IF;

  -- Get user's organization_id
  SELECT organization_id INTO v_user_org_id
  FROM profiles
  WHERE id = auth.uid()
  LIMIT 1;

  -- PRIORITY 2: Allow if user can access organization (existing member)
  IF can_access_organization(v_course.organization_id) THEN
    RETURN TRUE;
  END IF;

  -- PRIORITY 3: Allow if user's profile doesn't exist (new registration)
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid()) INTO v_profile_exists;
  IF NOT v_profile_exists THEN
    RETURN TRUE;
  END IF;

  -- PRIORITY 4: Allow if user has NULL organization_id (standalone learner)
  IF v_user_org_id IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Otherwise, deny
  RETURN FALSE;
END;
$$;

-- Drop existing policy
DROP POLICY IF EXISTS enrollments_student_self_enroll ON public.enrollments;

-- Create policy using the function
-- Note: In WITH CHECK, we reference columns directly without table alias
CREATE POLICY enrollments_student_self_enroll
ON public.enrollments
FOR INSERT
TO authenticated
WITH CHECK (
  student_id = auth.uid()
  AND can_self_enroll_in_course(course_id, enrollment_method)
);

COMMENT ON FUNCTION public.can_self_enroll_in_course(UUID, TEXT) IS 
'Helper function for enrollment RLS policy. Checks if a user can self-enroll in a course.
Prioritizes enrollment_method = join_code to ensure program code enrollments always work.';

COMMENT ON POLICY enrollments_student_self_enroll ON public.enrollments IS 
'Allows students to enroll themselves in courses. Uses function-based check to reliably access enrollment_method.
Updated 2025-12-19 to fix WITH CHECK clause limitations.';

COMMIT;

