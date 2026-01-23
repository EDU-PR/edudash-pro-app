-- filepath: supabase/migrations/20260121000006_fix_students_insert_policy.sql
-- Migration: Fix students INSERT policy for principals
-- Issue: students_principal_access policy has USING clause but no WITH CHECK clause
-- For INSERT operations, WITH CHECK is required to validate the new row data

-- Drop and recreate the students_principal_access policy with proper WITH CHECK
DROP POLICY IF EXISTS students_principal_access ON students;

CREATE POLICY students_principal_access ON students
FOR ALL
USING (
  -- For SELECT/UPDATE/DELETE: check if user can access existing row
  preschool_id IN (
    SELECT COALESCE(p.organization_id, p.preschool_id)
    FROM profiles p
    WHERE p.id = auth.uid() 
      AND p.role IN ('principal', 'preschool_admin', 'admin', 'superadmin', 'super_admin')
    UNION
    SELECT u.preschool_id
    FROM users u
    WHERE u.auth_user_id = auth.uid() 
      AND u.role IN ('principal', 'preschool_admin', 'admin', 'superadmin')
  )
)
WITH CHECK (
  -- For INSERT/UPDATE: validate that new/modified row belongs to user's school
  preschool_id IN (
    SELECT COALESCE(p.organization_id, p.preschool_id)
    FROM profiles p
    WHERE p.id = auth.uid() 
      AND p.role IN ('principal', 'preschool_admin', 'admin', 'superadmin', 'super_admin')
    UNION
    SELECT u.preschool_id
    FROM users u
    WHERE u.auth_user_id = auth.uid() 
      AND u.role IN ('principal', 'preschool_admin', 'admin', 'superadmin')
  )
);

-- Also fix students_tenant_modify which may have the same issue
DROP POLICY IF EXISTS students_tenant_modify ON students;

CREATE POLICY students_tenant_modify ON students
FOR ALL
USING (
  preschool_id IN (
    SELECT COALESCE(p.organization_id, p.preschool_id)
    FROM profiles p
    WHERE p.id = auth.uid()
    UNION
    SELECT COALESCE(u.organization_id, u.preschool_id)
    FROM users u
    WHERE u.id = auth.uid() OR u.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  preschool_id IN (
    SELECT COALESCE(p.organization_id, p.preschool_id)
    FROM profiles p
    WHERE p.id = auth.uid()
    UNION
    SELECT COALESCE(u.organization_id, u.preschool_id)
    FROM users u
    WHERE u.id = auth.uid() OR u.auth_user_id = auth.uid()
  )
);

-- Add helpful comments
COMMENT ON POLICY students_principal_access ON students IS 
'Allows principals, admins, and superadmins to manage all students in their school. WITH CHECK clause enables INSERT operations.';

COMMENT ON POLICY students_tenant_modify ON students IS 
'Allows users to manage students in their own school. WITH CHECK clause enables INSERT operations.';
