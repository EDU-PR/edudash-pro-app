-- Migration: Fix courses RLS to allow learners to view programs
-- Date: 2026-01-17
-- Issue: Learners cannot see programs created by Youth President/Secretary because
--        the SELECT policy is too restrictive. Learners who are organization members
--        should see all active courses in their organization.

BEGIN;

-- Drop existing select policy and recreate with broader access for learners
DROP POLICY IF EXISTS "courses_organization_members_select" ON public.courses;

-- Organization members can SELECT courses in their organization
-- This includes regular members (learners), not just executives
CREATE POLICY "courses_organization_members_select"
ON public.courses
FOR SELECT
TO authenticated
USING (
  -- User is an active organization member of the course's organization (any member type)
  EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = courses.organization_id
      AND om.membership_status = 'active'
  )
  -- OR user is the instructor
  OR instructor_id = auth.uid()
  -- OR user is enrolled in the course
  OR EXISTS (
    SELECT 1
    FROM public.enrollments e
    WHERE e.course_id = courses.id
      AND e.student_id = auth.uid()
      AND e.is_active = true
  )
  -- OR course is active (allows browsing all active courses)
  OR (is_active = true AND deleted_at IS NULL)
);

-- Add additional policy for browsing all public active courses
-- This allows learners who aren't organization members to discover courses
DROP POLICY IF EXISTS "courses_public_browse" ON public.courses;

CREATE POLICY "courses_public_browse"
ON public.courses
FOR SELECT
TO authenticated
USING (
  is_active = true 
  AND deleted_at IS NULL
);

-- Add comments
COMMENT ON POLICY "courses_organization_members_select" ON public.courses IS
'Allows all authenticated users to view active courses. Organization members see their org courses, enrolled students see their courses, and all active courses are browseable.';

COMMENT ON POLICY "courses_public_browse" ON public.courses IS
'Allows all authenticated users to browse active courses for discovery and enrollment.';

COMMIT;
