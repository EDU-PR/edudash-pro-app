-- Fix Enrollment RLS Policy to Allow Program Code Enrollments
-- Date: 2025-12-19
-- Purpose: Allow enrollment via program codes regardless of organization_id mismatch.
--          Program codes themselves are the authorization mechanism.

BEGIN;

-- Drop existing policy
DROP POLICY IF EXISTS enrollments_student_self_enroll ON public.enrollments;

-- Create updated policy that allows enrollment when:
-- 1. User can access the organization (existing member), OR
-- 2. User's profile doesn't exist (new registration), OR
-- 3. User has NULL organization_id (standalone learner), OR
-- 4. Enrollment method is 'join_code' (program code authorization - KEY FIX)
CREATE POLICY enrollments_student_self_enroll
ON public.enrollments
FOR INSERT
TO authenticated
WITH CHECK (
  student_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM courses c
    WHERE c.id = enrollments.course_id
      AND c.is_active = true
      AND c.deleted_at IS NULL
      AND (
        -- Allow if user can access organization (existing member)
        can_access_organization(c.organization_id)
        OR
        -- OR allow enrollment if user's profile doesn't exist (new registration)
        NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
        OR
        -- OR allow enrollment if user has NULL organization_id (standalone learner)
        (SELECT organization_id FROM profiles WHERE id = auth.uid()) IS NULL
        OR
        -- OR allow enrollment if enrollment_method is 'join_code' (program code authorization)
        -- This is the key fix: program codes authorize enrollment regardless of organization_id
        enrollments.enrollment_method = 'join_code'
      )
  )
);

COMMENT ON POLICY enrollments_student_self_enroll ON public.enrollments IS 
'Allows students to enroll themselves in courses. Supports organization members, standalone learners, and program code enrollments. Updated 2025-12-19 to allow program code enrollments regardless of organization_id mismatch. Program codes themselves serve as authorization.';

COMMIT;

