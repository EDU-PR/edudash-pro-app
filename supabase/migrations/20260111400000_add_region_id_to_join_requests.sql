-- Add region_id to join_requests table for proper region routing
-- Date: 2026-01-11
-- Issue: Invite codes were defaulting to Eastern Cape (EC) because join_requests
--        didn't store which region the invite belongs to

-- Add region_id column if it doesn't exist
ALTER TABLE join_requests 
ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES organization_regions(id);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_join_requests_region_id ON join_requests(region_id);

-- Comment explaining the column
COMMENT ON COLUMN join_requests.region_id IS 
'The region this invite is for. Set when invite is created to match the inviter''s region.';
