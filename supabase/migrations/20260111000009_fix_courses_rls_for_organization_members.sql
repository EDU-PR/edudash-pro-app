-- Fix courses table RLS policies to allow organization members (Youth President, Secretary, etc.) to create courses/programs
-- Date: 2026-01-11
-- Issue: Youth President/Secretary can't create programs because RLS policies don't allow organization members to insert courses

BEGIN;

-- Enable RLS on courses table if not already enabled
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "courses_organization_members_insert" ON public.courses;
DROP POLICY IF EXISTS "courses_organization_members_select" ON public.courses;
DROP POLICY IF EXISTS "courses_organization_members_update" ON public.courses;
DROP POLICY IF EXISTS "courses_organization_members_delete" ON public.courses;
DROP POLICY IF EXISTS "courses_service_role" ON public.courses;

-- Service role has full access
CREATE POLICY "courses_service_role"
ON public.courses
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create security definer function to check if user can create courses for an organization
CREATE OR REPLACE FUNCTION public.user_can_create_course(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = p_org_id
      AND om.membership_status = 'active'
      AND om.member_type IN (
        'youth_president',
        'youth_deputy', 
        'youth_secretary',
        'youth_treasurer',
        'president',
        'deputy_president',
        'secretary_general',
        'treasurer'
      )
  );
END;
$$;

-- Organization members (Youth President, Secretary, Deputy, Treasurer) can INSERT courses for their organization
CREATE POLICY "courses_organization_members_insert"
ON public.courses
FOR INSERT
TO authenticated
WITH CHECK (
  -- User must be an organization member with executive privileges
  public.user_can_create_course(organization_id)
  -- Instructor must be the authenticated user
  AND instructor_id = auth.uid()
);

-- Organization members can SELECT courses in their organization
CREATE POLICY "courses_organization_members_select"
ON public.courses
FOR SELECT
TO authenticated
USING (
  -- User is an organization member of the course's organization
  EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = courses.organization_id
      AND om.membership_status = 'active'
  )
  -- OR user is the instructor
  OR instructor_id = auth.uid()
  -- OR course is active and public (for viewing published programs)
  OR (is_active = true AND (metadata->>'program_type')::text = 'youth_program')
);

-- Organization executives (President, Secretary, etc.) can UPDATE courses in their organization
CREATE POLICY "courses_organization_members_update"
ON public.courses
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = courses.organization_id
      AND om.membership_status = 'active'
      AND om.member_type IN (
        'youth_president',
        'youth_deputy',
        'youth_secretary',
        'youth_treasurer',
        'president',
        'deputy_president',
        'secretary_general',
        'treasurer'
      )
  )
  -- OR user is the instructor and owns the course
  OR (instructor_id = auth.uid())
)
WITH CHECK (
  -- Same conditions for WITH CHECK
  EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = courses.organization_id
      AND om.membership_status = 'active'
      AND om.member_type IN (
        'youth_president',
        'youth_deputy',
        'youth_secretary',
        'youth_treasurer',
        'president',
        'deputy_president',
        'secretary_general',
        'treasurer'
      )
  )
  OR (instructor_id = auth.uid())
);

-- Organization executives can DELETE courses in their organization
CREATE POLICY "courses_organization_members_delete"
ON public.courses
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = courses.organization_id
      AND om.membership_status = 'active'
      AND om.member_type IN (
        'youth_president',
        'youth_deputy',
        'youth_secretary',
        'youth_treasurer',
        'president',
        'deputy_president',
        'secretary_general',
        'treasurer'
      )
  )
  -- OR user is the instructor and owns the course
  OR (instructor_id = auth.uid())
);

-- Add comments
COMMENT ON FUNCTION public.user_can_create_course(UUID) IS
'Security definer function to check if user can create courses for an organization. Returns true if user is an active organization member with executive privileges (youth_president, secretary, etc.)';

COMMENT ON POLICY "courses_organization_members_insert" ON public.courses IS
'Allows organization members (Youth President, Secretary, etc.) to create courses/programs for their organization';

COMMENT ON POLICY "courses_organization_members_select" ON public.courses IS
'Allows organization members to view courses/programs in their organization, or public youth programs';

COMMENT ON POLICY "courses_organization_members_update" ON public.courses IS
'Allows organization executives to update courses/programs in their organization, or instructors to update their own courses';

COMMENT ON POLICY "courses_organization_members_delete" ON public.courses IS
'Allows organization executives to delete courses/programs in their organization, or instructors to delete their own courses';

COMMIT;
