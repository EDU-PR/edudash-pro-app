-- Add temporary password column to join_requests for invite codes
-- This allows invite codes to include a pre-generated temporary password
-- that users can use to login immediately after joining

ALTER TABLE join_requests
ADD COLUMN IF NOT EXISTS temp_password TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN join_requests.temp_password IS 'Temporary password for invite codes. Users can use this to login immediately after joining with the invite code.';

-- Add index for faster lookups by invite code
CREATE INDEX IF NOT EXISTS idx_join_requests_invite_code ON join_requests(invite_code) WHERE invite_code IS NOT NULL;

-- Also add temp_password to region_invite_codes if it doesn't exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'region_invite_codes'
  ) THEN
    ALTER TABLE region_invite_codes
    ADD COLUMN IF NOT EXISTS temp_password TEXT;
    
    COMMENT ON COLUMN region_invite_codes.temp_password IS 'Temporary password for region invite codes. Users can use this to login immediately after joining with the invite code.';
  END IF;
END $$;
