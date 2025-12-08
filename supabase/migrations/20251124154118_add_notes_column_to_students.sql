-- Add notes column to students table
-- Supports optional additional information during registration

-- Add notes column
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN students.notes IS 'Optional additional notes about the student (e.g., learning preferences, special circumstances, etc.)';
