-- Migration: Fix duplicate foreign key on assignment_submissions table
-- The table has both assignment_id and homework_assignment_id pointing to homework_assignments
-- This causes HTTP 300 "Multiple Choices" errors in PostgREST queries
-- 
-- This migration removes the redundant homework_assignment_id column and its FK

-- First, check if any data uses homework_assignment_id that doesn't match assignment_id
-- If there's mismatched data, we need to handle it
DO $$
DECLARE
    mismatched_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO mismatched_count
    FROM assignment_submissions
    WHERE homework_assignment_id IS NOT NULL 
      AND homework_assignment_id != assignment_id;
    
    IF mismatched_count > 0 THEN
        RAISE NOTICE 'Found % records with mismatched homework_assignment_id values. Copying to assignment_id where assignment_id is null.', mismatched_count;
        
        -- Copy homework_assignment_id to assignment_id where assignment_id is null
        UPDATE assignment_submissions
        SET assignment_id = homework_assignment_id
        WHERE assignment_id IS NULL AND homework_assignment_id IS NOT NULL;
    END IF;
END $$;

-- Drop the redundant foreign key constraint
ALTER TABLE assignment_submissions
DROP CONSTRAINT IF EXISTS assignment_submissions_homework_assignment_id_fkey;

-- Drop the redundant column
ALTER TABLE assignment_submissions
DROP COLUMN IF EXISTS homework_assignment_id;

-- Add a comment explaining the schema
COMMENT ON COLUMN assignment_submissions.assignment_id IS 'Foreign key to homework_assignments table. This is the canonical reference column.';

-- Verify the constraint exists on assignment_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'assignment_submissions' 
        AND constraint_name = 'assignment_submissions_assignment_id_fkey'
    ) THEN
        -- Add the FK if it somehow doesn't exist
        ALTER TABLE assignment_submissions
        ADD CONSTRAINT assignment_submissions_assignment_id_fkey
        FOREIGN KEY (assignment_id) REFERENCES homework_assignments(id) ON DELETE CASCADE;
    END IF;
END $$;
