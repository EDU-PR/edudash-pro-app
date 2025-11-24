-- Add RLS policies to allow parents to insert and update their own children
-- Required for Community School auto-approval flow

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "students_parent_insert_own_children" ON students;
DROP POLICY IF EXISTS "students_parent_update_own_children" ON students;

-- Allow parents to insert their own children
-- This enables Community School parents to auto-register children
CREATE POLICY "students_parent_insert_own_children"
ON students
FOR INSERT
TO authenticated
WITH CHECK (
  parent_id = auth.uid()
  AND preschool_id IN (
    SELECT preschool_id 
    FROM profiles 
    WHERE id = auth.uid()
  )
);

-- Allow parents to update their own children
-- Enables parents to update child information
CREATE POLICY "students_parent_update_own_children"
ON students
FOR UPDATE
TO authenticated
USING (parent_id = auth.uid())
WITH CHECK (parent_id = auth.uid());

-- Add comments
COMMENT ON POLICY "students_parent_insert_own_children" ON students IS 
'Allows authenticated parents to insert student records for their own children in their preschool';

COMMENT ON POLICY "students_parent_update_own_children" ON students IS 
'Allows authenticated parents to update their own children''s information';
