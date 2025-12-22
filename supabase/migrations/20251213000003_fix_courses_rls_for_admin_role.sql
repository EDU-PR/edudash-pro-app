-- ============================================
-- Fix Courses RLS for Admin Role
-- Date: 2025-12-13
-- Purpose: Allow 'admin' role to create and manage courses in their organization
-- ============================================

-- Update is_instructor_level function to include 'admin' role
CREATE OR REPLACE FUNCTION public.is_instructor_level()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND LOWER(role) IN ('super_admin', 'superadmin', 'principal_admin', 'principal', 'teacher', 'admin')
    );
$$;

-- Update is_admin_level function to include 'admin' role explicitly
CREATE OR REPLACE FUNCTION public.is_admin_level()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND LOWER(role) IN ('super_admin', 'superadmin', 'principal_admin', 'principal', 'admin')
    );
$$;

-- Drop existing create policy if it exists
DROP POLICY IF EXISTS "courses_instructor_create" ON courses;

-- Create new policy that allows admin role to create courses
CREATE POLICY "courses_instructor_create" ON courses
    FOR INSERT WITH CHECK (
        public.is_instructor_level() AND
        public.can_access_organization(organization_id) AND
        instructor_id = auth.uid()
    );

-- Also allow admin role to create courses without instructor_id check (for admin creating programs)
CREATE POLICY "courses_admin_create" ON courses
    FOR INSERT WITH CHECK (
        public.is_admin_level() AND
        public.can_access_organization(organization_id)
    );

COMMENT ON POLICY "courses_admin_create" ON courses IS 'Allows organization admins (admin, principal, principal_admin, super_admin) to create courses in their organization';






