-- Fix students table RLS policies
-- Multiple policies incorrectly use profiles.id = auth.uid() 
-- but it should be profiles.auth_user_id = auth.uid()
-- auth.uid() returns the authenticated user's UUID from auth.users table
-- which matches auth_user_id in profiles, NOT the profile's id column

-- Drop the broken policies
DROP POLICY IF EXISTS "parents_view_school_students" ON students;
DROP POLICY IF EXISTS "students_parent_access" ON students;
DROP POLICY IF EXISTS "students_select_by_preschool_authenticated" ON students;
DROP POLICY IF EXISTS "students_teacher_access" ON students;
DROP POLICY IF EXISTS "students_tenant_modify" ON students;
DROP POLICY IF EXISTS "students_principal_access" ON students;

-- Recreate parents_view_school_students with correct auth check
CREATE POLICY "parents_view_school_students" ON students
  FOR SELECT
  USING (
    -- Parent can view their own children directly
    (parent_id = auth.uid()) 
    OR (guardian_id = auth.uid())
    -- Parent can view all students at their child's school
    OR (preschool_id IN (
      SELECT s.preschool_id 
      FROM students s 
      WHERE ((s.parent_id = auth.uid()) OR (s.guardian_id = auth.uid())) 
      AND s.preschool_id IS NOT NULL
    ))
    -- Staff at the school can view students (using correct auth_user_id)
    OR (EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.auth_user_id = auth.uid()
      AND COALESCE(p.organization_id, p.preschool_id) = students.preschool_id
    ))
  );

-- Recreate students_parent_access with correct auth check
CREATE POLICY "students_parent_access" ON students
  FOR SELECT
  USING (
    (parent_id = auth.uid()) 
    OR (guardian_id = auth.uid())
    OR (EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.auth_user_id = auth.uid()
      AND p.role = 'parent'
      AND (COALESCE(p.organization_id, p.preschool_id) = students.preschool_id 
           OR p.preschool_id = students.preschool_id)
    ))
  );

-- Recreate students_select_by_preschool_authenticated with correct auth check
CREATE POLICY "students_select_by_preschool_authenticated" ON students
  FOR SELECT
  USING (
    (EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.auth_user_id = auth.uid()
      AND COALESCE(p.organization_id, p.preschool_id) = students.preschool_id
    ))
    OR (EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_user_id = auth.uid()
      AND u.preschool_id = students.preschool_id
    ))
  );

-- Recreate students_teacher_access with correct auth check
CREATE POLICY "students_teacher_access" ON students
  FOR SELECT
  USING (
    (EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.auth_user_id = auth.uid()
      AND p.role IN ('teacher', 'instructor')
      AND COALESCE(p.organization_id, p.preschool_id) = students.preschool_id
      AND EXISTS (
        SELECT 1 FROM classes c 
        WHERE c.teacher_id = p.id AND c.id = students.class_id
      )
    ))
    OR (EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_user_id = auth.uid()
      AND u.role = 'teacher'
      AND u.preschool_id = students.preschool_id
      AND EXISTS (
        SELECT 1 FROM classes c 
        WHERE c.teacher_id = u.id AND c.id = students.class_id
      )
    ))
  );

-- Recreate students_tenant_modify with correct auth check
CREATE POLICY "students_tenant_modify" ON students
  FOR ALL
  USING (
    preschool_id IN (
      SELECT COALESCE(p.organization_id, p.preschool_id)
      FROM profiles p
      WHERE p.auth_user_id = auth.uid()
      UNION
      SELECT COALESCE(u.organization_id, u.preschool_id)
      FROM users u
      WHERE u.auth_user_id = auth.uid()
    )
  );

-- Recreate students_principal_access with correct auth check
CREATE POLICY "students_principal_access" ON students
  FOR ALL
  USING (
    preschool_id IN (
      SELECT COALESCE(p.organization_id, p.preschool_id)
      FROM profiles p
      WHERE p.auth_user_id = auth.uid()
      AND p.role IN ('principal', 'preschool_admin', 'admin', 'superadmin', 'super_admin')
      UNION
      SELECT u.preschool_id
      FROM users u
      WHERE u.auth_user_id = auth.uid()
      AND u.role IN ('principal', 'preschool_admin', 'admin', 'superadmin')
    )
  );

-- Add comments documenting the fix
COMMENT ON POLICY "parents_view_school_students" ON students IS 'Parents can view students at their school. Fixed to use auth_user_id instead of id.';
COMMENT ON POLICY "students_parent_access" ON students IS 'Parent access to students. Fixed to use auth_user_id instead of id.';
COMMENT ON POLICY "students_select_by_preschool_authenticated" ON students IS 'Authenticated users can view students at their preschool. Fixed to use auth_user_id.';
COMMENT ON POLICY "students_teacher_access" ON students IS 'Teachers can view students in their classes. Fixed to use auth_user_id.';
COMMENT ON POLICY "students_tenant_modify" ON students IS 'Tenant members can modify students. Fixed to use auth_user_id.';
COMMENT ON POLICY "students_principal_access" ON students IS 'Principals can manage all students at their school. Fixed to use auth_user_id.';
