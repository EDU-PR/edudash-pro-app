-- ============================================
-- Fix Assignment Submissions Schema
-- Date: 2025-12-13
-- Purpose: Add missing columns to assignment_submissions if they don't exist
-- ============================================

-- Check and add learner_id if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assignment_submissions' 
    AND column_name = 'learner_id'
  ) THEN
    ALTER TABLE assignment_submissions ADD COLUMN learner_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_assignment_submissions_learner_id ON assignment_submissions(learner_id);
  END IF;
END $$;

-- Check and add enrollment_id if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assignment_submissions' 
    AND column_name = 'enrollment_id'
  ) THEN
    ALTER TABLE assignment_submissions ADD COLUMN enrollment_id UUID REFERENCES enrollments(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_assignment_submissions_enrollment_id ON assignment_submissions(enrollment_id);
  END IF;
END $$;

-- Check and add files column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assignment_submissions' 
    AND column_name = 'files'
  ) THEN
    ALTER TABLE assignment_submissions ADD COLUMN files JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Check and add text_response if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assignment_submissions' 
    AND column_name = 'text_response'
  ) THEN
    ALTER TABLE assignment_submissions ADD COLUMN text_response TEXT;
  END IF;
END $$;

-- Check and add status if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assignment_submissions' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE assignment_submissions ADD COLUMN status TEXT NOT NULL DEFAULT 'draft';
    -- Add check constraint
    ALTER TABLE assignment_submissions ADD CONSTRAINT assignment_submissions_status_check 
      CHECK (status IN ('draft', 'submitted', 'graded', 'returned'));
  END IF;
END $$;

-- Ensure status index exists
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_status ON assignment_submissions(status);

-- Add/update RLS policies if they don't exist
DO $$
BEGIN
  -- Drop existing policies if any
  DROP POLICY IF EXISTS "Learners can view their own submissions" ON assignment_submissions;
  DROP POLICY IF EXISTS "Learners can create their own submissions" ON assignment_submissions;
  DROP POLICY IF EXISTS "Learners can update their own submissions" ON assignment_submissions;
  
  -- Create policies
  CREATE POLICY "Learners can view their own submissions"
    ON assignment_submissions FOR SELECT
    USING (auth.uid() = learner_id);
  
  CREATE POLICY "Learners can create their own submissions"
    ON assignment_submissions FOR INSERT
    WITH CHECK (auth.uid() = learner_id);
  
  CREATE POLICY "Learners can update their own submissions"
    ON assignment_submissions FOR UPDATE
    USING (auth.uid() = learner_id);
END $$;

-- Ensure RLS is enabled
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;







