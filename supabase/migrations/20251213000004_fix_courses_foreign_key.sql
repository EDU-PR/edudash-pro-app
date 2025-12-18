-- ============================================
-- Fix Courses Foreign Key to Organizations
-- Date: 2025-12-13
-- Purpose: Update courses.organization_id foreign key to reference organizations table instead of preschools
-- ============================================

-- Drop existing foreign key constraint
ALTER TABLE courses 
DROP CONSTRAINT IF EXISTS courses_organization_id_fkey;

-- Add new foreign key constraint to organizations table
ALTER TABLE courses 
ADD CONSTRAINT courses_organization_id_fkey 
FOREIGN KEY (organization_id) 
REFERENCES organizations(id) 
ON DELETE CASCADE;

COMMENT ON CONSTRAINT courses_organization_id_fkey ON courses IS 'References organizations table (standardized from preschools)';





