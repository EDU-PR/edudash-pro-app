-- Fix Lessons RLS Policies
-- This removes policies that reference the non-existent app_auth schema

-- Drop the problematic policies
DROP POLICY IF EXISTS lessons_tenant_isolation ON lessons;
DROP POLICY IF EXISTS superadmin_service_role_access ON lessons;

-- Create replacement policy for tenant isolation
-- Teachers can access lessons in their organization or public lessons
CREATE POLICY lessons_tenant_isolation ON lessons
FOR ALL
USING (
  preschool_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
  OR is_public = true
);

-- Create replacement policy for super admin access
CREATE POLICY lessons_superadmin_full_access ON lessons
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'super_admin'
  )
);
