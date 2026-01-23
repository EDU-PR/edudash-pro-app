-- Migration: Update students RLS policies to check profiles table
-- Issue: Policies check legacy users table but principals may only exist in profiles table

-- Drop and recreate the students_principal_access policy to check profiles too
DROP POLICY IF EXISTS students_principal_access ON students;

CREATE POLICY students_principal_access ON students
FOR ALL
USING (
  preschool_id IN (
    -- Check profiles table (newer system)
    SELECT COALESCE(p.organization_id, p.preschool_id)
    FROM profiles p
    WHERE p.id = auth.uid() 
      AND p.role IN ('principal', 'preschool_admin', 'admin', 'superadmin', 'super_admin')
    UNION
    -- Legacy: check users table
    SELECT u.preschool_id
    FROM users u
    WHERE u.auth_user_id = auth.uid() 
      AND u.role IN ('principal', 'preschool_admin', 'admin', 'superadmin')
  )
);

-- Update students_select_by_preschool_authenticated to also check profiles
DROP POLICY IF EXISTS students_select_by_preschool_authenticated ON students;

CREATE POLICY students_select_by_preschool_authenticated ON students
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid() 
      AND COALESCE(p.organization_id, p.preschool_id) = students.preschool_id
  )
  OR EXISTS (
    SELECT 1 
    FROM users u
    WHERE u.auth_user_id = auth.uid() 
      AND u.preschool_id = students.preschool_id
  )
);

-- Update students_teacher_access to also check profiles
DROP POLICY IF EXISTS students_teacher_access ON students;

CREATE POLICY students_teacher_access ON students
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid() 
      AND p.role IN ('teacher', 'instructor')
      AND COALESCE(p.organization_id, p.preschool_id) = students.preschool_id
      AND EXISTS (
        SELECT 1 FROM classes c
        WHERE c.teacher_id = p.id AND c.id = students.class_id
      )
  )
  OR EXISTS (
    SELECT 1 
    FROM users u
    WHERE u.auth_user_id = auth.uid() 
      AND u.role = 'teacher'
      AND u.preschool_id = students.preschool_id
      AND EXISTS (
        SELECT 1 FROM classes c
        WHERE c.teacher_id = u.id AND c.id = students.class_id
      )
  )
);

-- Update students_tenant_modify to also check profiles
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
);

-- Add helpful comments
COMMENT ON POLICY students_principal_access ON students IS 
'Allows principals, admins, and superadmins to access all students in their school. Checks both profiles and legacy users table.';

COMMENT ON POLICY students_select_by_preschool_authenticated ON students IS 
'Allows authenticated users to view students in their school. Checks both profiles and legacy users table.';
