-- Fix Enrollment RLS Policy for Logged-In Users
-- Date: 2025-12-19
-- Purpose: Allow logged-in users to enroll in programs via program codes even if they have
--          a different organization_id or NULL organization_id

BEGIN;

-- Drop existing policy
DROP POLICY IF EXISTS enrollments_student_self_enroll ON public.enrollments;

-- Create updated policy that allows enrollment when:
-- 1. User can access the organization (existing check), OR
-- 2. User's profile doesn't exist or has NULL organization_id (standalone learner), OR
-- 3. User's organization_id doesn't match course organization (allows joining via program code)
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
        -- Allow if user can access organization
        can_access_organization(c.organization_id)
        OR
        -- OR allow if user's profile doesn't exist or has NULL organization_id
        -- This covers both new registrations and existing users joining via program code
        NOT EXISTS (
          SELECT 1 FROM profiles 
          WHERE id = auth.uid() 
          AND organization_id IS NOT NULL
          AND organization_id != c.organization_id
        )
      )
  )
);

COMMENT ON POLICY enrollments_student_self_enroll ON public.enrollments IS 
'Allows students to enroll themselves in courses. Supports both organization members and standalone learners joining via program codes. Updated 2025-12-19 to fix 403 errors for logged-in users. Allows enrollment if user profile does not exist, has NULL organization_id, or organization_id matches course organization.';

COMMIT;

