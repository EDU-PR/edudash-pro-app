-- Create K-12 Schools Table
-- This is separate from preschools to properly handle Grade R-12 institutions
-- Purpose: Allow parents to register children at K-12 schools not yet on the platform

CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  province VARCHAR(100),
  city VARCHAR(100),
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(255),
  school_type VARCHAR(50), -- public, private, independent, community
  grades_offered VARCHAR(100), -- e.g., "Grade R-12", "Grade 1-7"
  is_default BOOLEAN DEFAULT FALSE, -- For EduDash Pro Community
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_schools_name ON schools(name);
CREATE INDEX IF NOT EXISTS idx_schools_active ON schools(is_active);
CREATE INDEX IF NOT EXISTS idx_schools_is_default ON schools(is_default);
CREATE INDEX IF NOT EXISTS idx_schools_province ON schools(province);

-- Enable RLS
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all active schools (for selection dropdown)
CREATE POLICY "schools_public_read"
ON schools
FOR SELECT
TO authenticated
USING (is_active = true);

-- Allow service role full access
CREATE POLICY "schools_service_role_all"
ON schools
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

COMMENT ON TABLE schools IS 'K-12 schools for student registration (separate from preschools)';
COMMENT ON COLUMN schools.is_default IS 'True for EduDash Pro Community (default option for unlisted schools)';

-- Insert EduDash Pro Community as default school
INSERT INTO schools (
  name,
  province,
  city,
  school_type,
  grades_offered,
  is_default,
  is_active,
  email,
  metadata
) VALUES (
  'EduDash Pro Community',
  'National',
  'Virtual',
  'community',
  'Playgroup - Grade 12',
  true,
  true,
  'support@edudashpro.org.za',
  jsonb_build_object(
    'description', 'Default school for children whose schools are not yet registered on EduDash Pro',
    'is_virtual', true,
    'supports_all_grades', true,
    'created_at', NOW()
  )
)
ON CONFLICT DO NOTHING;

-- Update students table to support school_id reference
-- Note: This allows students to be linked to either preschools OR schools
ALTER TABLE students ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_students_school ON students(school_id);

COMMENT ON COLUMN students.school_id IS 'K-12 school reference (mutually exclusive with preschool_id for older students)';

-- Verify creation
SELECT 
  id,
  name,
  school_type,
  grades_offered,
  is_default,
  is_active,
  email
FROM schools
WHERE is_default = true;
