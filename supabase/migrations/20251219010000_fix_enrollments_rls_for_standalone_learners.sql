-- Fix enrollments RLS policy to allow standalone learners to enroll via program codes
-- Date: 2025-12-19
-- Purpose: Allow users without organization_id to enroll in courses via program codes
-- This fixes the 400 error when standalone learners try to enroll after registration

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
        -- OR allow if user doesn't have an organization yet (standalone learner joining via code)
        -- This allows program code enrollments for users without an organization
        get_user_organization_id() IS NULL
      )
  )
);

COMMENT ON POLICY enrollments_student_self_enroll ON enrollments IS 
'Allows students to enroll themselves in courses. 
Supports both organization members and standalone learners joining via program codes.
Updated 2025-12-19 to fix 400 errors for standalone learners.';

