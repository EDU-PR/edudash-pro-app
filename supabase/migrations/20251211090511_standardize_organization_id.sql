-- Migration: Standardize organization_id across all tables
-- Replaces preschool_id with organization_id as the canonical field
-- Phase 1: Database Schema Standardization (Critical Priority)

BEGIN;

-- Step 1: Add organization_id column to tables that don't have it
-- (Most tables already have it from previous migrations, but we ensure consistency)

-- Check and add to classes table if needed
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'classes' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE classes ADD COLUMN organization_id UUID REFERENCES organizations(id);
    COMMENT ON COLUMN classes.organization_id IS 'Canonical organization reference (replaces preschool_id)';
  END IF;
END $$;

-- Check and add to attendance table if needed
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attendance' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE attendance ADD COLUMN organization_id UUID REFERENCES organizations(id);
    COMMENT ON COLUMN attendance.organization_id IS 'Canonical organization reference (replaces preschool_id)';
  END IF;
END $$;

-- Check and add to grades table if needed
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'grades' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE grades ADD COLUMN organization_id UUID REFERENCES organizations(id);
    COMMENT ON COLUMN grades.organization_id IS 'Canonical organization reference (replaces preschool_id)';
  END IF;
END $$;

-- Check and add to assessments table if needed
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assessments' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE assessments ADD COLUMN organization_id UUID REFERENCES organizations(id);
    COMMENT ON COLUMN assessments.organization_id IS 'Canonical organization reference (replaces preschool_id)';
  END IF;
END $$;

-- Check and add to lesson_plans table if needed (skip if table doesn't exist)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lesson_plans') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'lesson_plans' AND column_name = 'organization_id'
    ) THEN
      ALTER TABLE lesson_plans ADD COLUMN organization_id UUID REFERENCES organizations(id);
      COMMENT ON COLUMN lesson_plans.organization_id IS 'Canonical organization reference (replaces preschool_id)';
    END IF;
  END IF;
END $$;

-- Step 2: Migrate data from preschool_id to organization_id where organization_id is NULL
-- This handles any existing records that only have preschool_id
-- Only runs if both columns exist

DO $$
BEGIN
  -- Classes table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'classes' AND column_name = 'preschool_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'classes' AND column_name = 'organization_id'
  ) THEN
    UPDATE classes 
    SET organization_id = preschool_id 
    WHERE organization_id IS NULL AND preschool_id IS NOT NULL;
  END IF;
  
  -- Attendance table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attendance' AND column_name = 'preschool_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attendance' AND column_name = 'organization_id'
  ) THEN
    UPDATE attendance 
    SET organization_id = preschool_id 
    WHERE organization_id IS NULL AND preschool_id IS NOT NULL;
  END IF;
  
  -- Grades table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'grades' AND column_name = 'preschool_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'grades' AND column_name = 'organization_id'
  ) THEN
    UPDATE grades 
    SET organization_id = preschool_id 
    WHERE organization_id IS NULL AND preschool_id IS NOT NULL;
  END IF;
  
  -- Assessments table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assessments' AND column_name = 'preschool_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assessments' AND column_name = 'organization_id'
  ) THEN
    UPDATE assessments 
    SET organization_id = preschool_id 
    WHERE organization_id IS NULL AND preschool_id IS NOT NULL;
  END IF;
  
  -- Lesson plans table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lesson_plans' AND column_name = 'preschool_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lesson_plans' AND column_name = 'organization_id'
  ) THEN
    UPDATE lesson_plans 
    SET organization_id = preschool_id 
    WHERE organization_id IS NULL AND preschool_id IS NOT NULL;
  END IF;
  
  -- Profiles table (only copy if organization exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'preschool_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'organization_id'
  ) THEN
    UPDATE profiles 
    SET organization_id = preschool_id 
    WHERE organization_id IS NULL 
      AND preschool_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM organizations WHERE id = profiles.preschool_id);
  END IF;
END $$;

-- Step 3: Create indexes on organization_id for performance (only if tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'classes') THEN
    CREATE INDEX IF NOT EXISTS idx_classes_organization_id ON classes(organization_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attendance') THEN
    CREATE INDEX IF NOT EXISTS idx_attendance_organization_id ON attendance(organization_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'grades') THEN
    CREATE INDEX IF NOT EXISTS idx_grades_organization_id ON grades(organization_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assessments') THEN
    CREATE INDEX IF NOT EXISTS idx_assessments_organization_id ON assessments(organization_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lesson_plans') THEN
    CREATE INDEX IF NOT EXISTS idx_lesson_plans_organization_id ON lesson_plans(organization_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);
  END IF;
END $$;

-- Step 4: Add comments for documentation
COMMENT ON COLUMN profiles.organization_id IS 'Primary organization reference (canonical field, preschool_id is legacy)';
COMMENT ON COLUMN profiles.preschool_id IS 'DEPRECATED: Use organization_id instead. Kept for backward compatibility.';

-- Step 5: Create helper function to get organization_id (handles both fields)
-- Function may already exist from previous migrations - only create if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND p.proname = 'get_user_organization_id'
  ) THEN
    EXECUTE '
      CREATE FUNCTION get_user_organization_id(user_id UUID)
      RETURNS UUID
      LANGUAGE plpgsql
      STABLE
      SECURITY DEFINER
      AS $func$
      DECLARE
        org_id UUID;
      BEGIN
        SELECT COALESCE(organization_id, preschool_id)
        INTO org_id
        FROM profiles
        WHERE id = user_id;
        
        RETURN org_id;
      END;
      $func$';
  END IF;
END $$;

COMMENT ON FUNCTION get_user_organization_id IS 'Get user organization ID with backward compatibility for preschool_id';

-- Step 6: Create view for organization compatibility
DROP VIEW IF EXISTS user_organizations;

CREATE VIEW user_organizations AS
SELECT 
  id as user_id,
  COALESCE(organization_id, preschool_id) as organization_id,
  role,
  seat_status,
  capabilities
FROM profiles;

COMMENT ON VIEW user_organizations IS 'Unified view of user-organization relationships with backward compatibility';

COMMIT;

