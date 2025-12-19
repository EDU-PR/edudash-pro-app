-- Fix Enrollment RLS Policy - Simplify Logic
-- Date: 2025-12-19
-- Purpose: Simplify the policy logic to prioritize enrollment_method check and fix evaluation order

BEGIN;

-- Drop existing policy
DROP POLICY IF EXISTS enrollments_student_self_enroll ON public.enrollments;

-- Create simplified policy that prioritizes enrollment_method check
-- This ensures program code enrollments always work
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
        -- PRIORITY 1: If enrollment_method is 'join_code', always allow (program code authorization)
        enrollments.enrollment_method = 'join_code'
        OR
        -- PRIORITY 2: Allow if user can access organization (existing member)
        can_access_organization(c.organization_id)
        OR
        -- PRIORITY 3: Allow if user's profile doesn't exist (new registration)
        NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
        OR
        -- PRIORITY 4: Allow if user has NULL organization_id (standalone learner)
        (SELECT organization_id FROM profiles WHERE id = auth.uid()) IS NULL
      )
  )
);

COMMENT ON POLICY enrollments_student_self_enroll ON public.enrollments IS 
'Allows students to enroll themselves in courses. Prioritizes enrollment_method = join_code to ensure program code enrollments always work. Updated 2025-12-19 to fix evaluation order.';

COMMIT;

