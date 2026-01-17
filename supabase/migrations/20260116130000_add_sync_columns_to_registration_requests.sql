-- Add sync tracking columns to registration_requests table
-- These columns track the EduDash parent and student IDs created when registration is approved

-- Add columns for tracking synced entities
ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS edudash_parent_id UUID;
ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS edudash_student_id UUID;
ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_registration_requests_edudash_parent_id 
  ON registration_requests(edudash_parent_id) WHERE edudash_parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_registration_requests_edudash_student_id 
  ON registration_requests(edudash_student_id) WHERE edudash_student_id IS NOT NULL;

-- Add comment explaining columns
COMMENT ON COLUMN registration_requests.edudash_parent_id IS 'UUID of the parent profile created in EduDash when registration is approved';
COMMENT ON COLUMN registration_requests.edudash_student_id IS 'UUID of the student record created in EduDash when registration is approved';
COMMENT ON COLUMN registration_requests.synced_at IS 'Timestamp when the registration was synced to create parent/student records';
