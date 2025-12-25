-- Add usage_count column if not exists and create increment function
-- Migration: Add increment_invite_code_usage RPC function

-- Add usage_count column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'region_invite_codes' 
        AND column_name = 'usage_count'
    ) THEN
        ALTER TABLE region_invite_codes ADD COLUMN usage_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Create function to increment usage count
CREATE OR REPLACE FUNCTION increment_invite_code_usage(code_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE region_invite_codes
    SET usage_count = COALESCE(usage_count, 0) + 1,
        updated_at = NOW()
    WHERE id = code_id;
END;
$$;

-- Grant execute permission to authenticated users and anon
GRANT EXECUTE ON FUNCTION increment_invite_code_usage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_invite_code_usage(UUID) TO anon;

COMMENT ON FUNCTION increment_invite_code_usage(UUID) IS 
'Increments the usage count for a region invite code when a member joins using it';
