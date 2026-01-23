-- Migration: Fix attendance recorded_by foreign key constraint
-- Date: 2026-01-23
-- Description: 
--   The attendance.recorded_by column was incorrectly referencing public.users table
--   which only had 4 system/demo users. This caused FK violations when teachers tried
--   to submit attendance because their auth.users IDs didn't exist in public.users.
--   
--   This migration corrects the FK to reference auth.users instead, which is where
--   all authenticated users (teachers, principals) are stored.
--
-- Issue: "insert or update on table 'attendance' violates foreign key constraint 
--         'fk_attendance_recorded_by'"
--
-- Root Cause: The FK was pointing to public.users(id) instead of auth.users(id)

-- Drop the incorrect foreign key constraint
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS fk_attendance_recorded_by;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_recorded_by_fkey;

-- Add the correct foreign key referencing auth.users
ALTER TABLE attendance ADD CONSTRAINT fk_attendance_recorded_by 
  FOREIGN KEY (recorded_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add index for performance if not exists
CREATE INDEX IF NOT EXISTS idx_attendance_recorded_by ON attendance(recorded_by);

-- Add comment for documentation
COMMENT ON CONSTRAINT fk_attendance_recorded_by ON attendance IS 
  'References auth.users for the teacher/principal who recorded the attendance';
