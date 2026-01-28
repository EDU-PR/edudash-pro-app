-- Migration: Fix parent auth_user_id and enable multi-parent RLS support
-- Date: 2026-01-23
-- Description: 
--   1. Fix missing auth_user_id for parent profiles (critical for RLS)
--   2. Update students RLS policies to support multiple parents via student_parent_relationships table

-- ============================================================================
-- PART 1: Fix missing auth_user_id for parent profiles
-- ============================================================================
-- The auth_user_id is required for RLS policies to work correctly.
-- When profiles were created via POP verification flow, auth_user_id was not set.

UPDATE profiles p
SET auth_user_id = p.id,
    updated_at = NOW()
WHERE p.role = 'parent' 
  AND p.auth_user_id IS NULL
  AND EXISTS (SELECT 1 FROM auth.users a WHERE a.id = p.id);

-- ============================================================================
-- PART 2: Update RLS policies for multi-parent support
-- ============================================================================
-- Previously, parents could only see students where they were directly linked
-- via parent_id or guardian_id. This update adds support for the 
-- student_parent_relationships junction table, allowing:
--   - Both parents to have access to the same child
--   - Additional guardians/caretakers to be added without modifying the student record

-- Drop existing parent policies
DROP POLICY IF EXISTS students_parent_own_children ON students;
DROP POLICY IF EXISTS students_parent_update_own_children ON students;

-- Recreate SELECT policy with multi-parent support
CREATE POLICY students_parent_own_children ON students
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.auth_user_id = auth.uid()
    AND (
      -- Direct link via parent_id or guardian_id (legacy/primary support)
      students.parent_id = p.id 
      OR students.guardian_id = p.id
      -- OR via the student_parent_relationships junction table (multi-parent)
      OR EXISTS (
        SELECT 1 FROM student_parent_relationships spr
        WHERE spr.student_id = students.id
        AND spr.parent_id = p.id
      )
    )
  )
);

-- Recreate UPDATE policy with multi-parent support
CREATE POLICY students_parent_update_own_children ON students
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.auth_user_id = auth.uid()
    AND (
      students.parent_id = p.id 
      OR students.guardian_id = p.id
      OR EXISTS (
        SELECT 1 FROM student_parent_relationships spr
        WHERE spr.student_id = students.id
        AND spr.parent_id = p.id
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.auth_user_id = auth.uid()
    AND (
      students.parent_id = p.id 
      OR students.guardian_id = p.id
      OR EXISTS (
        SELECT 1 FROM student_parent_relationships spr
        WHERE spr.student_id = students.id
        AND spr.parent_id = p.id
      )
    )
  )
);

-- ============================================================================
-- PART 3: Add index for performance (junction table queries)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_student_parent_relationships_student_id 
ON student_parent_relationships(student_id);

CREATE INDEX IF NOT EXISTS idx_student_parent_relationships_parent_id 
ON student_parent_relationships(parent_id);

CREATE INDEX IF NOT EXISTS idx_student_parent_relationships_composite 
ON student_parent_relationships(student_id, parent_id);

-- ============================================================================
-- Usage Notes:
-- ============================================================================
-- To link a second parent to an existing child:
-- 
-- INSERT INTO student_parent_relationships (student_id, parent_id, relationship_type, is_primary)
-- VALUES (
--   'student-uuid',
--   'second-parent-profile-uuid',
--   'parent',  -- or 'guardian', 'other'
--   false      -- false for secondary parent
-- );
--
-- The first/primary parent should still be linked via students.parent_id for backwards
-- compatibility with existing queries that don't check the junction table.
