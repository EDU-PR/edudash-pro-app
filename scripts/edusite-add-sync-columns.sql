-- Add sync tracking columns to registration_requests table
-- Run this in the EduSitePro database (bppuzibjlxgfwrujzfsz.supabase.co)

-- Add columns for tracking sync status
ALTER TABLE registration_requests
ADD COLUMN IF NOT EXISTS synced_to_edudash BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS edudash_student_id UUID,
ADD COLUMN IF NOT EXISTS edudash_parent_id UUID;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_registration_requests_synced 
ON registration_requests(synced_to_edudash, status);

-- Add index for searching by sync status
CREATE INDEX IF NOT EXISTS idx_registration_requests_status_synced 
ON registration_requests(status, synced_to_edudash);

-- Add comment for documentation
COMMENT ON COLUMN registration_requests.synced_to_edudash IS 'Whether this registration has been synced to EduDashPro database';
COMMENT ON COLUMN registration_requests.synced_at IS 'Timestamp when the registration was synced to EduDashPro';
COMMENT ON COLUMN registration_requests.edudash_student_id IS 'UUID of the student created in EduDashPro';
COMMENT ON COLUMN registration_requests.edudash_parent_id IS 'UUID of the parent profile created in EduDashPro';
