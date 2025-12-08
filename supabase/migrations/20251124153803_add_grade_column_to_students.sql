-- Add grade column to students table for Community School
-- Supports auto-grade assignment based on age during registration

-- Add grade column
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS grade TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN students.grade IS 'Student grade level (e.g., "Pre-K", "Grade R", "Grade 1-12"). Auto-assigned based on age if not specified.';

-- Create index for grade filtering
CREATE INDEX IF NOT EXISTS idx_students_grade ON students(grade);
