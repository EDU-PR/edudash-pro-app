-- Migration: Fix students and classes RLS policies that incorrectly use parent_id/guardian_id = auth.uid()
-- Problem: These policies check parent_id = auth.uid() or guardian_id = auth.uid()
-- But parent_id and guardian_id contain profile.id values, not auth.users UUIDs
-- Solution: Join to profiles table to check p.auth_user_id = auth.uid() and compare with p.id

-- ============================================================================
-- 1. Fix parents_view_school_students on students table
-- ============================================================================
DROP POLICY IF EXISTS parents_view_school_students ON students;

CREATE POLICY parents_view_school_students ON students
FOR SELECT
TO authenticated
USING (
    -- Parent can view their own children and children in the same school
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.auth_user_id = auth.uid()
        AND (
            -- Direct parent/guardian of this student
            students.parent_id = p.id 
            OR students.guardian_id = p.id
            -- Or same preschool
            OR COALESCE(p.organization_id, p.preschool_id) = students.preschool_id
        )
    )
);

-- ============================================================================
-- 2. Fix students_parent_access on students table
-- ============================================================================
DROP POLICY IF EXISTS students_parent_access ON students;

CREATE POLICY students_parent_access ON students
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.auth_user_id = auth.uid()
        AND p.role = 'parent'
        AND (
            students.parent_id = p.id 
            OR students.guardian_id = p.id
            OR COALESCE(p.organization_id, p.preschool_id) = students.preschool_id
        )
    )
);

-- ============================================================================
-- 3. Fix students_parent_update_own_children on students table
-- ============================================================================
DROP POLICY IF EXISTS students_parent_update_own_children ON students;

CREATE POLICY students_parent_update_own_children ON students
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.auth_user_id = auth.uid()
        AND (students.parent_id = p.id OR students.guardian_id = p.id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.auth_user_id = auth.uid()
        AND (students.parent_id = p.id OR students.guardian_id = p.id)
    )
);

-- ============================================================================
-- 4. Fix parents_view_child_classes on classes table
-- ============================================================================
DROP POLICY IF EXISTS parents_view_child_classes ON classes;

CREATE POLICY parents_view_child_classes ON classes
FOR SELECT
TO authenticated
USING (
    -- Parent can view classes their children are in
    EXISTS (
        SELECT 1 FROM students s
        JOIN profiles p ON (s.parent_id = p.id OR s.guardian_id = p.id)
        WHERE p.auth_user_id = auth.uid()
        AND s.class_id = classes.id
    )
    -- Or they can view through the standard function
    OR user_can_view_classes(preschool_id, teacher_id)
);

-- ============================================================================
-- 5. Add simpler classes view policy for org members
-- ============================================================================
DROP POLICY IF EXISTS classes_org_members_select ON classes;

CREATE POLICY classes_org_members_select ON classes
FOR SELECT
TO authenticated
USING (
    -- Anyone in the same org can view classes
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.auth_user_id = auth.uid()
        AND COALESCE(p.organization_id, p.preschool_id) = classes.preschool_id
    )
);

-- ============================================================================
-- Add comments
-- ============================================================================
COMMENT ON POLICY parents_view_school_students ON students IS 
  'Fixed: Uses profiles.id comparison instead of direct auth.uid() comparison';
COMMENT ON POLICY classes_org_members_select ON classes IS 
  'Allow any authenticated user in the same org to view classes';
