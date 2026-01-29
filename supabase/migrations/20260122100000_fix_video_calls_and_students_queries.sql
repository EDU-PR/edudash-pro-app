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

DO $video_calls$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'video_calls'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS video_calls_select_policy ON video_calls';
    EXECUTE 'DROP POLICY IF EXISTS video_calls_insert_policy ON video_calls';
    EXECUTE 'DROP POLICY IF EXISTS video_calls_update_policy ON video_calls';
    EXECUTE 'DROP POLICY IF EXISTS video_calls_delete_policy ON video_calls';
    EXECUTE 'DROP POLICY IF EXISTS teachers_manage_own_video_calls ON video_calls';
    EXECUTE 'DROP POLICY IF EXISTS principals_manage_school_video_calls ON video_calls';
    EXECUTE 'DROP POLICY IF EXISTS parents_view_class_video_calls ON video_calls';
    EXECUTE 'DROP POLICY IF EXISTS staff_view_school_video_calls ON video_calls';

    EXECUTE 'ALTER TABLE video_calls ENABLE ROW LEVEL SECURITY';

    EXECUTE 'CREATE POLICY staff_view_school_video_calls ON video_calls FOR SELECT TO authenticated USING (preschool_id IN (SELECT COALESCE(p.organization_id, p.preschool_id) FROM profiles p WHERE p.id = auth.uid() AND p.role IN (''principal'', ''principal_admin'', ''teacher'', ''admin'', ''super_admin'')))';

    EXECUTE 'CREATE POLICY parents_view_class_video_calls ON video_calls FOR SELECT TO authenticated USING (class_id IN (SELECT s.class_id FROM students s WHERE (s.parent_id = auth.uid() OR s.guardian_id = auth.uid()) AND s.class_id IS NOT NULL) OR (class_id IS NULL AND preschool_id IN (SELECT DISTINCT s.preschool_id FROM students s WHERE s.parent_id = auth.uid() OR s.guardian_id = auth.uid())))';

    EXECUTE 'CREATE POLICY teachers_insert_video_calls ON video_calls FOR INSERT TO authenticated WITH CHECK (teacher_id = auth.uid() AND preschool_id IN (SELECT COALESCE(p.organization_id, p.preschool_id) FROM profiles p WHERE p.id = auth.uid() AND p.role IN (''principal'', ''principal_admin'', ''teacher'')))';

    EXECUTE 'CREATE POLICY teachers_update_own_video_calls ON video_calls FOR UPDATE TO authenticated USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid())';

    EXECUTE 'CREATE POLICY principals_update_school_video_calls ON video_calls FOR UPDATE TO authenticated USING (preschool_id IN (SELECT COALESCE(p.organization_id, p.preschool_id) FROM profiles p WHERE p.id = auth.uid() AND p.role IN (''principal'', ''principal_admin'', ''super_admin'')))';

    EXECUTE 'CREATE POLICY teachers_delete_own_video_calls ON video_calls FOR DELETE TO authenticated USING (teacher_id = auth.uid())';

    EXECUTE 'CREATE POLICY principals_delete_school_video_calls ON video_calls FOR DELETE TO authenticated USING (preschool_id IN (SELECT COALESCE(p.organization_id, p.preschool_id) FROM profiles p WHERE p.id = auth.uid() AND p.role IN (''principal'', ''principal_admin'', ''super_admin'')))';
  ELSE
    RAISE NOTICE 'Skipping video_calls policies: video_calls table missing';
  END IF;
END;
$video_calls$;

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

DO $classes$
DECLARE
  has_classes BOOLEAN;
  has_classes_preschool_id BOOLEAN;
  has_students BOOLEAN;
  has_students_class_id BOOLEAN;
  has_students_parent_id BOOLEAN;
  has_students_guardian_id BOOLEAN;
  has_students_preschool_id BOOLEAN;
  has_profiles BOOLEAN;
  has_profile_role BOOLEAN;
  has_profile_org BOOLEAN;
  has_profile_preschool BOOLEAN;
  parents_condition TEXT := '';
  staff_condition TEXT := '';
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'classes'
  ) INTO has_classes;

  IF NOT has_classes THEN
    RAISE NOTICE 'Skipping classes policies: classes table missing';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'preschool_id'
  ) INTO has_classes_preschool_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'students'
  ) INTO has_students;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'class_id'
  ) INTO has_students_class_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'parent_id'
  ) INTO has_students_parent_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'guardian_id'
  ) INTO has_students_guardian_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'preschool_id'
  ) INTO has_students_preschool_id;

  IF has_students AND has_students_preschool_id AND (has_students_parent_id OR has_students_guardian_id) THEN
    IF has_students_class_id THEN
      parents_condition := 'id IN (SELECT s.class_id FROM students s WHERE (s.parent_id = auth.uid() OR s.guardian_id = auth.uid()) AND s.class_id IS NOT NULL)';
      parents_condition := parents_condition || ' OR preschool_id IN (SELECT DISTINCT s.preschool_id FROM students s WHERE s.parent_id = auth.uid() OR s.guardian_id = auth.uid())';
    ELSE
      parents_condition := 'preschool_id IN (SELECT DISTINCT s.preschool_id FROM students s WHERE s.parent_id = auth.uid() OR s.guardian_id = auth.uid())';
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) INTO has_profiles;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
  ) INTO has_profile_role;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'organization_id'
  ) INTO has_profile_org;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'preschool_id'
  ) INTO has_profile_preschool;

  IF has_profiles AND has_profile_role AND (has_profile_org OR has_profile_preschool) AND has_classes_preschool_id THEN
    staff_condition := 'preschool_id IN (SELECT COALESCE(p.organization_id, p.preschool_id) FROM profiles p WHERE p.id = auth.uid() AND p.role IN (''principal'', ''principal_admin'', ''teacher'', ''admin'', ''super_admin''))';
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS parents_view_child_classes ON classes';
  EXECUTE 'DROP POLICY IF EXISTS authenticated_read_classes ON classes';

  IF parents_condition <> '' THEN
    EXECUTE 'CREATE POLICY parents_view_child_classes ON classes FOR SELECT TO authenticated USING (' || parents_condition || ')';
  ELSE
    RAISE NOTICE 'Skipping parents_view_child_classes: required columns missing';
  END IF;

  IF staff_condition <> '' THEN
    EXECUTE 'CREATE POLICY staff_view_school_classes ON classes FOR SELECT TO authenticated USING (' || staff_condition || ')';
  ELSE
    RAISE NOTICE 'Skipping staff_view_school_classes: required columns missing';
  END IF;
END;
$classes$;

-- =============================================================================
-- PART 5: Grant necessary permissions
-- =============================================================================

DO $grants$
BEGIN
  IF to_regclass('public.video_calls') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON video_calls TO authenticated';
    EXECUTE 'GRANT ALL ON video_calls TO service_role';
  END IF;
  IF to_regclass('public.students') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON students TO authenticated';
    EXECUTE 'GRANT ALL ON students TO service_role';
  END IF;
  IF to_regclass('public.classes') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON classes TO authenticated';
    EXECUTE 'GRANT ALL ON classes TO service_role';
  END IF;
  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON profiles TO authenticated';
    EXECUTE 'GRANT ALL ON profiles TO service_role';
  END IF;
END;
$grants$;

-- =============================================================================
-- PART 6: Add indexes to improve FK join performance
-- =============================================================================

-- Index for faster parent lookup on students
CREATE INDEX IF NOT EXISTS idx_students_parent_id ON students(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_students_guardian_id ON students(guardian_id) WHERE guardian_id IS NOT NULL;

DO $video_calls_indexes$
BEGIN
  IF to_regclass('public.video_calls') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'video_calls' AND column_name = 'class_id'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_video_calls_class_id ON video_calls(class_id) WHERE class_id IS NOT NULL';
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'video_calls' AND column_name = 'teacher_id'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_video_calls_teacher_id ON video_calls(teacher_id)';
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'video_calls' AND column_name = 'preschool_id'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_video_calls_preschool_status ON video_calls(preschool_id, status)';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping video_calls indexes: table missing';
  END IF;
END;
$video_calls_indexes$;

-- Index for faster org lookup on profiles
CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON profiles(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_preschool_id ON profiles(preschool_id) WHERE preschool_id IS NOT NULL;

-- =============================================================================
-- End of migration
-- =============================================================================
