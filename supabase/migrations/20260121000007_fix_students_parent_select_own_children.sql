-- filepath: supabase/migrations/20260121000007_fix_students_parent_select_own_children.sql
-- Migration: Fix students SELECT policy for parents to see their own children
-- Issue: Parents cannot see their own children because the existing policy only 
-- checks school membership, not parent_id/guardian_id relationship

-- Drop the existing parent search policy (it was only for searching students in school)
DROP POLICY IF EXISTS students_parent_search_in_school ON students;

-- Create a comprehensive policy that allows parents to:
-- 1. SELECT their own children (by parent_id or guardian_id)
-- 2. Search for other students in their school (for "claim child" feature)
CREATE POLICY students_parent_access ON students
FOR SELECT
USING (
  -- Parent can see their own children (linked by parent_id or guardian_id)
  (parent_id = auth.uid() OR guardian_id = auth.uid())
  OR
  -- Parent can search students in their school (for claiming unlinked children)
  (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'parent'
        AND (
          COALESCE(p.organization_id, p.preschool_id) = students.preschool_id
          OR p.preschool_id = students.preschool_id
        )
    )
  )
);

-- Add comment explaining the policy
COMMENT ON POLICY students_parent_access ON students IS 
'Allows parents to: 1) View their own children (parent_id/guardian_id match), 2) Search students in their school for claiming';
