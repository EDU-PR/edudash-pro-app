-- Fix Profiles Upsert and Enrollment RLS Policies
-- Date: 2025-12-19
-- Purpose: 
-- 1. Allow users to upsert their own profile (for setting organization_id during registration)
-- 2. Ensure enrollment policy works even when profile doesn't exist or has NULL organization_id

BEGIN;

-- ============================================================================
-- PART 1: Fix Profiles RLS for Upsert Operations
-- ============================================================================

-- The issue: When using upsert with on_conflict=id, Supabase checks both INSERT and UPDATE policies
-- We need to ensure both allow the user to set their own profile data

-- Drop and recreate INSERT policy to allow users to insert their own profile
DROP POLICY IF EXISTS users_insert_own_profile ON public.profiles;

CREATE POLICY users_insert_own_profile
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Ensure UPDATE policy allows users to update their own profile (including organization_id)
DROP POLICY IF EXISTS users_update_own_profile ON public.profiles;

CREATE POLICY users_update_own_profile
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

COMMENT ON POLICY users_insert_own_profile ON public.profiles IS 
'Allows authenticated users to insert their own profile record. Used during registration.';

COMMENT ON POLICY users_update_own_profile ON public.profiles IS 
'Allows authenticated users to update their own profile, including organization_id. Used during registration with program codes.';

-- ============================================================================
-- PART 2: Fix Enrollment RLS Policy
-- ============================================================================

-- The issue: The enrollment policy checks if profile.organization_id IS NULL,
-- but if the profile doesn't exist yet, the subquery might fail or return unexpected results.
-- We need to make the check more robust.

DROP POLICY IF EXISTS enrollments_student_self_enroll ON public.enrollments;

CREATE POLICY enrollments_student_self_enroll
ON public.enrollments
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
        -- OR allow enrollment if user's profile doesn't exist or has NULL organization_id
        -- This covers program code enrollments during registration and for standalone learners
        -- Check if profile exists and has NULL organization_id, or if profile doesn't exist
        (
          NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
          OR
          (SELECT organization_id FROM profiles WHERE id = auth.uid()) IS NULL
        )
      )
  )
);

COMMENT ON POLICY enrollments_student_self_enroll ON public.enrollments IS 
'Allows students to enroll themselves in courses. 
Supports both organization members and standalone learners joining via program codes.
Updated 2025-12-19 to fix 403 errors during registration flow.
Allows enrollment if user profile does not exist or has NULL organization_id (covers registration flow and standalone learners).';

COMMIT;

