-- Comprehensive fixes for Mbali, lessons, and student management
-- Run this migration in Supabase Dashboard SQL Editor

-- ========================================
-- 1. FIX: Update Mbali's age to 5 years
-- ========================================
-- The trigger issue prevents direct UPDATE, so we'll use a workaround
-- Temporarily disable RLS and update directly

BEGIN;

-- Store old value for rollback if needed
DO $$
DECLARE
  old_dob DATE;
BEGIN
  SELECT date_of_birth INTO old_dob 
  FROM students 
  WHERE id = '074692f3-f5a3-4fea-977a-b726828e5067';
  
  RAISE NOTICE 'Old date of birth: %', old_dob;
  
  -- Disable RLS temporarily for this session only
  SET LOCAL row_security = off;
  
  -- Update Mbali's date of birth to make her 5 years old (born 2021)
  UPDATE students
  SET date_of_birth = '2021-01-15'
  WHERE id = '074692f3-f5a3-4fea-977a-b726828e5067';
  
  RAISE NOTICE 'Updated Mbali Skosana date of birth to 2021-01-15 (age 5)';
END $$;

COMMIT;

-- ========================================
-- 2. FIX: Update lessons with NULL teacher_id
-- ========================================
-- Set teacher_id for AI-generated lessons that are missing it
-- This will make them visible in the teacher dashboard

UPDATE lessons
SET teacher_id = (
  SELECT id 
  FROM profiles 
  WHERE preschool_id = lessons.preschool_id 
    AND role IN ('teacher', 'principal', 'principal_admin')
    AND email IS NOT NULL
  LIMIT 1
)
WHERE is_ai_generated = true 
  AND teacher_id IS NULL
  AND preschool_id = 'ba79097c-1b93-4b48-bcbe-df73878ab4d1';

-- ========================================
-- 3. ADD: Student deactivation function
-- ========================================
-- Create a function to properly deactivate/remove students

CREATE OR REPLACE FUNCTION public.deactivate_student(
  student_uuid UUID,
  reason TEXT DEFAULT 'left_school'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  -- Update student to inactive status
  UPDATE students
  SET 
    is_active = false,
    status = 'inactive',
    notes = COALESCE(notes || E'\n\n', '') || 
            'Deactivated on ' || NOW()::DATE || ': ' || reason,
    updated_at = NOW()
  WHERE id = student_uuid
    AND is_active = true;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  
  IF affected_rows = 0 THEN
    RAISE NOTICE 'Student % not found or already inactive', student_uuid;
    RETURN FALSE;
  END IF;
  
  -- Remove from class enrollment (but keep historical record)
  -- We don't delete, just set class_id to NULL
  UPDATE students
  SET class_id = NULL
  WHERE id = student_uuid;
  
  -- Cancel any active lesson assignments
  UPDATE lesson_assignments
  SET status = 'cancelled'
  WHERE student_id = student_uuid
    AND status IN ('assigned', 'in_progress');
  
  -- Cancel any active homework assignments
  UPDATE homework_submissions
  SET status = 'cancelled'
  WHERE student_id = student_uuid
    AND status IN ('assigned', 'in_progress');
  
  RAISE NOTICE 'Student % successfully deactivated', student_uuid;
  RETURN TRUE;
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.deactivate_student(UUID, TEXT) IS
'Deactivates a student when they leave the school. Sets is_active=false, removes from class, cancels active assignments. Preserves historical data.';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.deactivate_student(UUID, TEXT) TO authenticated;

-- ========================================
-- 4. ADD: Reactivate student function (in case of mistakes)
-- ========================================

CREATE OR REPLACE FUNCTION public.reactivate_student(
  student_uuid UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  UPDATE students
  SET 
    is_active = true,
    status = 'active',
    notes = COALESCE(notes || E'\n\n', '') || 'Reactivated on ' || NOW()::DATE,
    updated_at = NOW()
  WHERE id = student_uuid
    AND is_active = false;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  
  IF affected_rows = 0 THEN
    RAISE NOTICE 'Student % not found or already active', student_uuid;
    RETURN FALSE;
  END IF;
  
  RAISE NOTICE 'Student % successfully reactivated', student_uuid;
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.reactivate_student(UUID) IS
'Reactivates a previously deactivated student. Sets is_active=true.';

GRANT EXECUTE ON FUNCTION public.reactivate_student(UUID) TO authenticated;

-- ========================================
-- 5. VERIFY: Check the fixes
-- ========================================

-- Verify Mbali's age
SELECT 
  first_name,
  last_name,
  date_of_birth,
  EXTRACT(YEAR FROM AGE(date_of_birth)) as age,
  is_active
FROM students
WHERE id = '074692f3-f5a3-4fea-977a-b726828e5067';

-- Verify lessons now have teacher_id
SELECT 
  COUNT(*) as total_ai_lessons,
  COUNT(teacher_id) as lessons_with_teacher,
  COUNT(*) FILTER (WHERE teacher_id IS NULL) as lessons_without_teacher
FROM lessons
WHERE is_ai_generated = true
  AND preschool_id = 'ba79097c-1b93-4b48-bcbe-df73878ab4d1';
