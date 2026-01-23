-- Migration: Fix students and classes RLS policies for parent access
-- Issue: Parents can view their children's school data (birthdays, etc.) 
--        but RLS policies only check preschool_id on profiles
-- Solution: Add policies that allow parents to view data for schools where their children attend

-- ================================================================
-- STUDENTS TABLE - Add parent access via children
-- ================================================================

-- First check if policy exists and drop it
DROP POLICY IF EXISTS "parents_view_own_children" ON public.students;
DROP POLICY IF EXISTS "parents_view_school_students" ON public.students;

-- Allow parents to view students at the same school as their children
CREATE POLICY "parents_view_school_students" ON public.students
FOR SELECT
USING (
  -- Direct parent access to their own children
  parent_id = auth.uid()
  OR
  -- Guardian access
  guardian_id = auth.uid()
  OR
  -- Parents can see students at schools where their children attend
  -- This enables birthday chart and class lists
  preschool_id IN (
    SELECT s.preschool_id 
    FROM students s 
    WHERE (s.parent_id = auth.uid() OR s.guardian_id = auth.uid())
      AND s.preschool_id IS NOT NULL
  )
  OR
  -- Staff access (existing logic)
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND COALESCE(p.organization_id, p.preschool_id) = students.preschool_id
  )
);

-- ================================================================
-- CLASSES TABLE - Add parent access via children
-- ================================================================

-- Drop existing parent-related policies if they exist
DROP POLICY IF EXISTS "parents_view_child_classes" ON public.classes;

-- Allow parents to view classes at schools where their children attend
CREATE POLICY "parents_view_child_classes" ON public.classes
FOR SELECT
USING (
  -- Parents can view classes at schools where their children attend
  preschool_id IN (
    SELECT s.preschool_id 
    FROM students s 
    WHERE (s.parent_id = auth.uid() OR s.guardian_id = auth.uid())
      AND s.preschool_id IS NOT NULL
  )
  OR
  -- Staff access via existing function
  public.user_can_view_classes(preschool_id, teacher_id)
);

-- ================================================================
-- Add comments
-- ================================================================
COMMENT ON POLICY "parents_view_school_students" ON public.students IS 
'Allows parents to view students at schools where their own children attend. Enables birthday chart and class lists for parent users.';

COMMENT ON POLICY "parents_view_child_classes" ON public.classes IS 
'Allows parents to view classes at schools where their children attend.';
