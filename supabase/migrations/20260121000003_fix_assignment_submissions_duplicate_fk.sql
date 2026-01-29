-- Migration: Fix duplicate foreign key on assignment_submissions table
-- The table has both assignment_id and homework_assignment_id pointing to homework_assignments
-- This causes HTTP 300 "Multiple Choices" errors in PostgREST queries
-- 
-- This migration removes the redundant homework_assignment_id column and its FK

DO $fix$
DECLARE
  table_exists BOOLEAN;
  has_homework_assignment_id BOOLEAN;
  mismatched_count INTEGER;
  homework_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'assignment_submissions'
  ) INTO table_exists;

  IF NOT table_exists THEN
    RAISE NOTICE 'Skipping assignment_submissions FK cleanup: table missing';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assignment_submissions' AND column_name = 'homework_assignment_id'
  ) INTO has_homework_assignment_id;

  IF has_homework_assignment_id THEN
    SELECT COUNT(*) INTO mismatched_count
    FROM assignment_submissions
    WHERE homework_assignment_id IS NOT NULL 
      AND homework_assignment_id != assignment_id;
    
    IF mismatched_count > 0 THEN
      RAISE NOTICE 'Found % records with mismatched homework_assignment_id values. Copying to assignment_id where assignment_id is null.', mismatched_count;
      
      UPDATE assignment_submissions
      SET assignment_id = homework_assignment_id
      WHERE assignment_id IS NULL AND homework_assignment_id IS NOT NULL;
    END IF;
  END IF;

  EXECUTE 'ALTER TABLE assignment_submissions DROP CONSTRAINT IF EXISTS assignment_submissions_homework_assignment_id_fkey';
  EXECUTE 'ALTER TABLE assignment_submissions DROP COLUMN IF EXISTS homework_assignment_id';

  EXECUTE 'COMMENT ON COLUMN assignment_submissions.assignment_id IS ''Foreign key to homework_assignments table. This is the canonical reference column.''';

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'homework_assignments'
  ) INTO homework_exists;

  IF homework_exists THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'assignment_submissions' 
      AND constraint_name = 'assignment_submissions_assignment_id_fkey'
    ) THEN
      EXECUTE 'ALTER TABLE assignment_submissions ADD CONSTRAINT assignment_submissions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES homework_assignments(id) ON DELETE CASCADE';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping assignment_submissions FK add: homework_assignments table missing';
  END IF;
END;
$fix$;
