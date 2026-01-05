-- Fix student_fees RLS policy for parents
-- 
-- Problem: The current guardians_view_own_child_fees policy only checks student_guardians table,
-- but parent-student relationships are also stored in students.parent_id and students.guardian_id.
-- This causes parents to not see fee updates after POP approval.
--
-- Solution: Create a comprehensive policy that checks all parent-student relationships.

-- Drop the incomplete policy
DROP POLICY IF EXISTS "guardians_view_own_child_fees" ON student_fees;

-- Create comprehensive parent/guardian policy that checks all relationship sources
CREATE POLICY "parents_guardians_view_fees" ON student_fees
FOR SELECT
TO authenticated
USING (
  -- Check 1: Direct parent relationship via students.parent_id
  student_id IN (
    SELECT id FROM students WHERE parent_id = auth.uid()
  )
  OR
  -- Check 2: Guardian relationship via students.guardian_id
  student_id IN (
    SELECT id FROM students WHERE guardian_id = auth.uid()
  )
  OR
  -- Check 3: Legacy guardian relationship via student_guardians table
  student_id IN (
    SELECT student_id FROM student_guardians WHERE guardian_id = auth.uid()
  )
);

-- Also allow parents to see when status changes (for realtime updates)
-- Note: Supabase realtime respects RLS policies, so the SELECT policy above
-- enables parents to receive UPDATE events for their children's fees

-- Add index to improve query performance
CREATE INDEX IF NOT EXISTS idx_students_parent_id ON students(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_students_guardian_id ON students(guardian_id) WHERE guardian_id IS NOT NULL;

-- Comment for documentation
COMMENT ON POLICY "parents_guardians_view_fees" ON student_fees IS 
'Allows parents and guardians to view fees for their children. 
Checks students.parent_id, students.guardian_id, and student_guardians table.';
