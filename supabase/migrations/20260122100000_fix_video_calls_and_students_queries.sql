-- Migration: Fix video_calls and students FK queries
-- Date: 2026-01-22
-- 
-- Issues addressed:
-- 1. 500 error on video_calls query with teacher:teacher_id join
-- 2. 400 error on students query with profiles!students_parent_id_fkey join
--
-- Root causes:
-- - Missing or incorrect RLS policies for parent users
-- - FK relationships not properly configured for PostgREST joins

-- =============================================================================
-- PART 1: Fix students table for parent access
-- =============================================================================

-- Drop existing problematic policies if they exist
DROP POLICY IF EXISTS "parents_view_school_students" ON students;
DROP POLICY IF EXISTS "parents_view_their_children" ON students;

-- Policy: Parents can view their own children
CREATE POLICY "parents_view_their_children"
ON students
FOR SELECT
TO authenticated
USING (
  parent_id = auth.uid()
  OR guardian_id = auth.uid()
);

-- Policy: Parents can view students at schools where their children attend
-- (Needed for class lists, birthday charts, etc.)
CREATE POLICY "parents_view_school_students_via_child"
ON students
FOR SELECT
TO authenticated
USING (
  preschool_id IN (
    SELECT DISTINCT s.preschool_id 
    FROM students s 
    WHERE s.parent_id = auth.uid() OR s.guardian_id = auth.uid()
  )
);

-- =============================================================================
-- PART 2: Fix video_calls table RLS policies
-- =============================================================================

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "video_calls_select_policy" ON video_calls;
DROP POLICY IF EXISTS "video_calls_insert_policy" ON video_calls;
DROP POLICY IF EXISTS "video_calls_update_policy" ON video_calls;
DROP POLICY IF EXISTS "video_calls_delete_policy" ON video_calls;
DROP POLICY IF EXISTS "teachers_manage_own_video_calls" ON video_calls;
DROP POLICY IF EXISTS "principals_manage_school_video_calls" ON video_calls;
DROP POLICY IF EXISTS "parents_view_class_video_calls" ON video_calls;
DROP POLICY IF EXISTS "staff_view_school_video_calls" ON video_calls;

-- Enable RLS if not already enabled
ALTER TABLE video_calls ENABLE ROW LEVEL SECURITY;

-- Policy: Staff (principals and teachers) can view all video calls at their school
CREATE POLICY "staff_view_school_video_calls"
ON video_calls
FOR SELECT
TO authenticated
USING (
  preschool_id IN (
    SELECT COALESCE(p.organization_id, p.preschool_id)
    FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('principal', 'principal_admin', 'teacher', 'admin', 'super_admin')
  )
);

-- Policy: Parents can view video calls for classes their children are in
CREATE POLICY "parents_view_class_video_calls"
ON video_calls
FOR SELECT
TO authenticated
USING (
  class_id IN (
    SELECT s.class_id 
    FROM students s 
    WHERE (s.parent_id = auth.uid() OR s.guardian_id = auth.uid())
    AND s.class_id IS NOT NULL
  )
  OR
  -- Also allow viewing school-wide calls (no specific class)
  (class_id IS NULL AND preschool_id IN (
    SELECT DISTINCT s.preschool_id 
    FROM students s 
    WHERE s.parent_id = auth.uid() OR s.guardian_id = auth.uid()
  ))
);

-- Policy: Teachers can create video calls for their school
CREATE POLICY "teachers_insert_video_calls"
ON video_calls
FOR INSERT
TO authenticated
WITH CHECK (
  teacher_id = auth.uid()
  AND preschool_id IN (
    SELECT COALESCE(p.organization_id, p.preschool_id)
    FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('principal', 'principal_admin', 'teacher')
  )
);

-- Policy: Teachers can update their own video calls
CREATE POLICY "teachers_update_own_video_calls"
ON video_calls
FOR UPDATE
TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

-- Policy: Principals can update any video call at their school
CREATE POLICY "principals_update_school_video_calls"
ON video_calls
FOR UPDATE
TO authenticated
USING (
  preschool_id IN (
    SELECT COALESCE(p.organization_id, p.preschool_id)
    FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('principal', 'principal_admin', 'super_admin')
  )
);

-- Policy: Teachers can delete their own video calls
CREATE POLICY "teachers_delete_own_video_calls"
ON video_calls
FOR DELETE
TO authenticated
USING (teacher_id = auth.uid());

-- Policy: Principals can delete any video call at their school
CREATE POLICY "principals_delete_school_video_calls"
ON video_calls
FOR DELETE
TO authenticated
USING (
  preschool_id IN (
    SELECT COALESCE(p.organization_id, p.preschool_id)
    FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('principal', 'principal_admin', 'super_admin')
  )
);

-- =============================================================================
-- PART 3: Fix profiles table RLS for FK joins
-- =============================================================================

-- Ensure profiles can be read for FK joins (teacher names, parent names)
DROP POLICY IF EXISTS "profiles_public_fields_for_fk_joins" ON profiles;

-- Policy: Allow reading basic profile info for authenticated users
-- This is needed for PostgREST FK joins to work
CREATE POLICY "profiles_public_fields_for_fk_joins"
ON profiles
FOR SELECT
TO authenticated
USING (
  -- Users can always see their own profile
  id = auth.uid()
  OR
  -- Users can see profiles of people in the same organization
  COALESCE(organization_id, preschool_id) IN (
    SELECT COALESCE(p.organization_id, p.preschool_id)
    FROM profiles p
    WHERE p.id = auth.uid()
  )
  OR
  -- Parents can see profiles of teachers at their children's schools
  id IN (
    SELECT vc.teacher_id
    FROM video_calls vc
    WHERE vc.class_id IN (
      SELECT s.class_id FROM students s 
      WHERE s.parent_id = auth.uid() OR s.guardian_id = auth.uid()
    )
  )
  OR
  -- Parents can see other parent profiles at their children's schools
  id IN (
    SELECT s.parent_id FROM students s
    WHERE s.preschool_id IN (
      SELECT DISTINCT s2.preschool_id 
      FROM students s2 
      WHERE s2.parent_id = auth.uid() OR s2.guardian_id = auth.uid()
    )
    UNION
    SELECT s.guardian_id FROM students s
    WHERE s.preschool_id IN (
      SELECT DISTINCT s2.preschool_id 
      FROM students s2 
      WHERE s2.parent_id = auth.uid() OR s2.guardian_id = auth.uid()
    )
  )
);

-- =============================================================================
-- PART 4: Fix classes table RLS for FK joins
-- =============================================================================

-- Ensure classes can be read for FK joins
DROP POLICY IF EXISTS "parents_view_child_classes" ON classes;
DROP POLICY IF EXISTS "authenticated_read_classes" ON classes;

-- Policy: Parents can view classes their children are in
CREATE POLICY "parents_view_child_classes"
ON classes
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT s.class_id 
    FROM students s 
    WHERE (s.parent_id = auth.uid() OR s.guardian_id = auth.uid())
    AND s.class_id IS NOT NULL
  )
  OR
  -- Also allow viewing all classes at child's school (for enrollment options)
  preschool_id IN (
    SELECT DISTINCT s.preschool_id 
    FROM students s 
    WHERE s.parent_id = auth.uid() OR s.guardian_id = auth.uid()
  )
);

-- Policy: Staff can view all classes at their school
CREATE POLICY "staff_view_school_classes"
ON classes
FOR SELECT
TO authenticated
USING (
  preschool_id IN (
    SELECT COALESCE(p.organization_id, p.preschool_id)
    FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('principal', 'principal_admin', 'teacher', 'admin', 'super_admin')
  )
);

-- =============================================================================
-- PART 5: Grant necessary permissions
-- =============================================================================

-- Ensure authenticated users can access these tables
GRANT SELECT ON video_calls TO authenticated;
GRANT SELECT ON students TO authenticated;
GRANT SELECT ON classes TO authenticated;
GRANT SELECT ON profiles TO authenticated;

-- Allow service role full access for Edge Functions
GRANT ALL ON video_calls TO service_role;
GRANT ALL ON students TO service_role;
GRANT ALL ON classes TO service_role;
GRANT ALL ON profiles TO service_role;

-- =============================================================================
-- PART 6: Add indexes to improve FK join performance
-- =============================================================================

-- Index for faster parent lookup on students
CREATE INDEX IF NOT EXISTS idx_students_parent_id ON students(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_students_guardian_id ON students(guardian_id) WHERE guardian_id IS NOT NULL;

-- Index for faster class lookup on video_calls
CREATE INDEX IF NOT EXISTS idx_video_calls_class_id ON video_calls(class_id) WHERE class_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_video_calls_teacher_id ON video_calls(teacher_id);
CREATE INDEX IF NOT EXISTS idx_video_calls_preschool_status ON video_calls(preschool_id, status);

-- Index for faster org lookup on profiles
CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON profiles(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_preschool_id ON profiles(preschool_id) WHERE preschool_id IS NOT NULL;

-- =============================================================================
-- End of migration
-- =============================================================================
