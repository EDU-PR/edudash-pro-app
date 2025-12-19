-- Fix enrollments RLS policy to allow enrollment during registration via program codes
-- Date: 2025-12-19
-- Purpose: Allow users to enroll in courses immediately after registration when using program codes
-- This fixes the 42501 error when users try to enroll during the registration flow

-- Drop and recreate the policy with updated logic
DROP POLICY IF EXISTS enrollments_student_self_enroll ON enrollments;

CREATE POLICY enrollments_student_self_enroll
ON enrollments
FOR INSERT
TO authenticated
WITH CHECK (
  -- User must be enrolling themselves
  student_id = auth.uid()
  AND
  -- Course must exist, be active, and not deleted
  EXISTS (
    SELECT 1
    FROM courses c
    WHERE c.id = enrollments.course_id
      AND c.is_active = true
      AND c.deleted_at IS NULL
      AND (
        -- Allow if user can access the organization (has org_id and matches)
        can_access_organization(c.organization_id)
        OR
        -- OR allow enrollment if user's profile doesn't have organization_id set
        -- This covers program code enrollments during registration and for standalone learners
        -- Check if profile exists and has NULL organization_id, or if profile doesn't exist yet
        (
          SELECT organization_id 
          FROM profiles 
          WHERE id = auth.uid()
        ) IS NULL
      )
  )
);

COMMENT ON POLICY enrollments_student_self_enroll ON enrollments IS 
'Allows students to enroll themselves in courses. 
Supports both organization members and standalone learners joining via program codes.
Updated 2025-12-19 to fix 42501 errors during registration flow.
Allows enrollment if user has no organization_id set (covers registration flow and standalone learners).';

