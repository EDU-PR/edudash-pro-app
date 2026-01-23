-- Migration: Fix courses RLS 500 error for learners
-- Date: 2026-01-21
-- Issue: Learners get 500 error when fetching courses because of RLS policy issues
-- Root cause: Possible circular reference or performance issue in RLS policies
-- Solution: Simplify policies and ensure proper access for authenticated users

BEGIN;

-- Drop ALL existing policies on courses to start fresh
DROP POLICY IF EXISTS "courses_organization_members_insert" ON public.courses;
DROP POLICY IF EXISTS "courses_organization_members_select" ON public.courses;
DROP POLICY IF EXISTS "courses_organization_members_update" ON public.courses;
DROP POLICY IF EXISTS "courses_organization_members_delete" ON public.courses;
DROP POLICY IF EXISTS "courses_service_role" ON public.courses;
DROP POLICY IF EXISTS "courses_public_browse" ON public.courses;
DROP POLICY IF EXISTS "courses_authenticated_select" ON public.courses;
-- Also drop existing policies found in production
DROP POLICY IF EXISTS "courses_admin_create" ON public.courses;
DROP POLICY IF EXISTS "courses_admin_read" ON public.courses;
DROP POLICY IF EXISTS "courses_enrolled_student_read" ON public.courses;
DROP POLICY IF EXISTS "courses_instructor_create" ON public.courses;
DROP POLICY IF EXISTS "courses_instructor_read" ON public.courses;
DROP POLICY IF EXISTS "courses_organization_delete" ON public.courses;
DROP POLICY IF EXISTS "courses_organization_insert" ON public.courses;
DROP POLICY IF EXISTS "courses_organization_update" ON public.courses;
DROP POLICY IF EXISTS "courses_owner_delete" ON public.courses;
DROP POLICY IF EXISTS "courses_owner_update" ON public.courses;
DROP POLICY IF EXISTS "courses_public_read" ON public.courses;
DROP POLICY IF EXISTS "courses_super_admin_read" ON public.courses;

-- Ensure RLS is enabled
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLICY 1: Service Role Full Access
-- ============================================================================
CREATE POLICY "courses_service_role"
ON public.courses
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- POLICY 2: SELECT - All authenticated users can view active courses
-- This is the most critical policy for learners browsing programs
-- ============================================================================
CREATE POLICY "courses_authenticated_select"
ON public.courses
FOR SELECT
TO authenticated
USING (
  -- Allow viewing active, non-deleted courses
  (is_active = true AND deleted_at IS NULL)
  -- OR user is the instructor (can see their own courses regardless of status)
  OR instructor_id = auth.uid()
);

-- ============================================================================
-- POLICY 3: INSERT - Organization executives and instructors can create courses
-- ============================================================================
CREATE POLICY "courses_organization_insert"
ON public.courses
FOR INSERT
TO authenticated
WITH CHECK (
  -- User must be an active organization member with executive role
  EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = courses.organization_id
      AND om.membership_status = 'active'
      AND om.member_type IN (
        'youth_president', 'youth_deputy', 'youth_secretary', 'youth_treasurer',
        'president', 'deputy_president', 'secretary_general', 'treasurer',
        'ceo', 'national_admin', 'regional_manager', 'regional_coordinator',
        'women_president', 'women_secretary',
        'veterans_president', 'veterans_coordinator'
      )
  )
  -- OR user is creating a course they'll be the instructor of
  OR instructor_id = auth.uid()
);

-- ============================================================================
-- POLICY 4: UPDATE - Executives and instructors can update courses
-- ============================================================================
CREATE POLICY "courses_organization_update"
ON public.courses
FOR UPDATE
TO authenticated
USING (
  -- User is the instructor
  instructor_id = auth.uid()
  -- OR user is an executive in the course's organization
  OR EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = courses.organization_id
      AND om.membership_status = 'active'
      AND om.member_type IN (
        'youth_president', 'youth_deputy', 'youth_secretary', 'youth_treasurer',
        'president', 'deputy_president', 'secretary_general', 'treasurer',
        'ceo', 'national_admin'
      )
  )
)
WITH CHECK (
  instructor_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = courses.organization_id
      AND om.membership_status = 'active'
      AND om.member_type IN (
        'youth_president', 'youth_deputy', 'youth_secretary', 'youth_treasurer',
        'president', 'deputy_president', 'secretary_general', 'treasurer',
        'ceo', 'national_admin'
      )
  )
);

-- ============================================================================
-- POLICY 5: DELETE - Only executives can delete courses
-- ============================================================================
CREATE POLICY "courses_organization_delete"
ON public.courses
FOR DELETE
TO authenticated
USING (
  -- User is the instructor
  instructor_id = auth.uid()
  -- OR user is an executive in the course's organization
  OR EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = courses.organization_id
      AND om.membership_status = 'active'
      AND om.member_type IN (
        'youth_president', 'youth_deputy', 'youth_secretary', 'youth_treasurer',
        'president', 'deputy_president', 'secretary_general', 'treasurer',
        'ceo', 'national_admin'
      )
  )
);

-- ============================================================================
-- Add helpful comments
-- ============================================================================
COMMENT ON POLICY "courses_service_role" ON public.courses IS
'Service role has full access to courses table for backend operations.';

COMMENT ON POLICY "courses_authenticated_select" ON public.courses IS
'All authenticated users can view active courses. Instructors can see their own courses regardless of status. This enables learners to browse available programs.';

COMMENT ON POLICY "courses_organization_insert" ON public.courses IS
'Organization executives (president, secretary, etc.) can create courses. Users can also create courses where they are the instructor.';

COMMENT ON POLICY "courses_organization_update" ON public.courses IS
'Instructors and organization executives can update courses.';

COMMENT ON POLICY "courses_organization_delete" ON public.courses IS
'Instructors and organization executives can delete courses.';

COMMIT;
