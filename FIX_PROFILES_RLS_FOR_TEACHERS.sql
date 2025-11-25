-- Allow teachers to see parent profiles in their preschool
-- This is needed for the ParentContactsWidget to work

-- Create or replace policy for teachers to view parents in same preschool
CREATE POLICY profiles_teachers_can_view_parents ON profiles
FOR SELECT
USING (
  -- Users can see their own profile
  id = auth.uid()
  OR
  -- Teachers can see parents and students in their preschool
  (
    preschool_id IN (
      SELECT preschool_id 
      FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('teacher', 'principal', 'admin')
    )
    AND role IN ('parent', 'student')
  )
  OR
  -- Parents can see teachers and other parents in their preschool
  (
    preschool_id IN (
      SELECT preschool_id 
      FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'parent'
    )
    AND role IN ('teacher', 'parent', 'principal')
  )
  OR
  -- Principals and admins can see all profiles in their preschool
  (
    preschool_id IN (
      SELECT preschool_id 
      FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('principal', 'admin')
    )
  )
);

SELECT 'SUCCESS: Teachers can now view parent profiles in their preschool' AS status;
