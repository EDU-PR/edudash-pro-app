-- Trial Usage Tracking
-- Ensures users can only activate trial once, even if they delete their account
-- Tracks by email, phone, and device fingerprint

CREATE TABLE IF NOT EXISTS trial_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  phone TEXT,
  device_fingerprint TEXT,
  user_id UUID,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- At least one identifier must be present
  CONSTRAINT at_least_one_identifier CHECK (
    email IS NOT NULL OR 
    phone IS NOT NULL OR 
    device_fingerprint IS NOT NULL
  )
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_trial_usage_log_email ON trial_usage_log(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trial_usage_log_phone ON trial_usage_log(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trial_usage_log_device ON trial_usage_log(device_fingerprint) WHERE device_fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trial_usage_log_user_id ON trial_usage_log(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trial_usage_log_activated_at ON trial_usage_log(activated_at DESC);

-- RLS policies
ALTER TABLE trial_usage_log ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write (prevent users from seeing or manipulating trial history)
CREATE POLICY "Service role full access" ON trial_usage_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to check if trial has been used
CREATE OR REPLACE FUNCTION has_used_trial(
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_device_fingerprint TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM trial_usage_log
    WHERE 
      (p_email IS NOT NULL AND email = p_email) OR
      (p_phone IS NOT NULL AND phone = p_phone) OR
      (p_device_fingerprint IS NOT NULL AND device_fingerprint = p_device_fingerprint)
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log trial activation
CREATE OR REPLACE FUNCTION log_trial_activation(
  p_user_id UUID,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_device_fingerprint TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  -- Check if at least one identifier is provided
  IF p_email IS NULL AND p_phone IS NULL AND p_device_fingerprint IS NULL THEN
    RAISE EXCEPTION 'At least one identifier (email, phone, or device_fingerprint) must be provided';
  END IF;

  -- Insert trial log
  INSERT INTO trial_usage_log (
    user_id,
    email,
    phone,
    device_fingerprint,
    metadata
  ) VALUES (
    p_user_id,
    p_email,
    p_phone,
    p_device_fingerprint,
    p_metadata
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill existing trial users
INSERT INTO trial_usage_log (user_id, email, phone, metadata)
SELECT 
  p.id,
  p.email,
  p.phone,
  jsonb_build_object(
    'backfilled', true,
    'backfill_date', NOW(),
    'original_trial_flag', p.is_trial
  )
FROM profiles p
WHERE p.is_trial = true
ON CONFLICT DO NOTHING;

COMMENT ON TABLE trial_usage_log IS 'Tracks trial usage to prevent multiple trial activations per user, persists even after account deletion';
COMMENT ON FUNCTION has_used_trial IS 'Check if a user has previously used a trial based on email, phone, or device fingerprint';
COMMENT ON FUNCTION log_trial_activation IS 'Log a trial activation with user identifiers for permanent tracking';
