-- =====================================================
-- ADD MISSING STUDENT AND ORGANIZATION FIELDS
-- Purpose: Support standalone organizations without websites
-- Date: 2025-12-01
-- =====================================================

-- Add missing columns to students table
ALTER TABLE students 
  ADD COLUMN IF NOT EXISTS student_id VARCHAR(50) UNIQUE,
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS academic_year VARCHAR(10) DEFAULT '2025',
  ADD COLUMN IF NOT EXISTS id_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS home_address TEXT,
  ADD COLUMN IF NOT EXISTS home_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS medication TEXT;

-- Add missing columns to organizations table
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS school_code VARCHAR(20) UNIQUE,
  ADD COLUMN IF NOT EXISTS principal_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS academic_year VARCHAR(10) DEFAULT '2025',
  ADD COLUMN IF NOT EXISTS enrollment_open BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS max_students INTEGER DEFAULT 500;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id);
CREATE INDEX IF NOT EXISTS idx_students_organization_id ON students(organization_id);
CREATE INDEX IF NOT EXISTS idx_students_academic_year ON students(academic_year);
CREATE INDEX IF NOT EXISTS idx_students_id_number ON students(id_number);
CREATE INDEX IF NOT EXISTS idx_organizations_school_code ON organizations(school_code);
CREATE INDEX IF NOT EXISTS idx_organizations_principal ON organizations(principal_id);
CREATE INDEX IF NOT EXISTS idx_organizations_academic_year ON organizations(academic_year);

-- Add comments for documentation
COMMENT ON COLUMN students.student_id IS 'Unique student identifier (e.g., YE-25-0001)';
COMMENT ON COLUMN students.organization_id IS 'Organization/tenant that owns this student record';
COMMENT ON COLUMN students.academic_year IS 'Academic year for enrollment (e.g., 2025, 2026)';
COMMENT ON COLUMN students.id_number IS 'National ID or passport number';
COMMENT ON COLUMN students.home_address IS 'Student home address';
COMMENT ON COLUMN students.home_phone IS 'Home phone number';
COMMENT ON COLUMN students.medication IS 'Current medication and dosage information';

COMMENT ON COLUMN organizations.school_code IS 'Unique code for parent registration (e.g., YE-2025)';
COMMENT ON COLUMN organizations.principal_id IS 'Principal/administrator user ID';
COMMENT ON COLUMN organizations.enrollment_open IS 'Whether school is accepting new registrations';
COMMENT ON COLUMN organizations.max_students IS 'Maximum student capacity';

-- Backfill organization_id from preschool_id
-- organizations.preschool_id points TO preschools.id (not the reverse)
UPDATE students s
SET organization_id = o.id
FROM organizations o
WHERE s.preschool_id = o.preschool_id
  AND s.organization_id IS NULL;

-- Add constraint to ensure students have either preschool_id or organization_id
ALTER TABLE students
  ADD CONSTRAINT students_must_have_tenant 
  CHECK (preschool_id IS NOT NULL OR organization_id IS NOT NULL);

COMMENT ON CONSTRAINT students_must_have_tenant ON students IS 
  'Ensures every student belongs to either a preschool or organization for tenant isolation';
