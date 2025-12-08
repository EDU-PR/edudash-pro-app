-- Add grade column to students table for digital school grade tracking
-- Grade can be: Pre-K, Grade R, Grade 1-12, or custom values

ALTER TABLE students 
ADD COLUMN IF NOT EXISTS grade TEXT;

-- Add comment for documentation
COMMENT ON COLUMN students.grade IS 'Student grade level (e.g., Pre-K, Grade R, Grade 1-12)';

-- Create index for faster grade-based queries
CREATE INDEX IF NOT EXISTS idx_students_grade ON students(grade);

-- Update existing students to have a default grade if NULL
UPDATE students 
SET grade = 'Not specified'
WHERE grade IS NULL;
