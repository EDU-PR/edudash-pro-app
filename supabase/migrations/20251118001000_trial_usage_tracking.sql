-- Trial Usage Tracking (prevents trial abuse)
-- Tracks trial usage by email/phone to prevent users from creating multiple accounts

-- Table to track trial usage attempts
CREATE TABLE IF NOT EXISTS trial_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  phone text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  trial_granted_at timestamptz NOT NULL DEFAULT now(),
  trial_type text NOT NULL, -- 'personal' or 'organization'
  trial_tier text NOT NULL,
  device_fingerprint text,
  ip_address inet,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_trial_usage_email ON trial_usage_log(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trial_usage_phone ON trial_usage_log(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trial_usage_user_id ON trial_usage_log(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trial_usage_created_at ON trial_usage_log(created_at DESC);

-- RLS policies
ALTER TABLE trial_usage_log ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write (prevents users from seeing trial history)
CREATE POLICY "Service role full access" ON trial_usage_log
  FOR ALL
  USING (auth.role() = 'service_role');

-- Function to check if email/phone has used trial before
CREATE OR REPLACE FUNCTION has_used_trial(
  check_email text DEFAULT NULL,
  check_phone text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if email or phone exists in trial log
  RETURN EXISTS (
    SELECT 1 
    FROM trial_usage_log
    WHERE 
      (check_email IS NOT NULL AND email = check_email)
      OR (check_phone IS NOT NULL AND phone = check_phone)
    LIMIT 1
  );
END;
$$;

-- Function to log trial usage
CREATE OR REPLACE FUNCTION log_trial_usage(
  user_email text,
  user_phone text DEFAULT NULL,
  user_uuid uuid DEFAULT NULL,
  tier text DEFAULT 'trial',
  trial_kind text DEFAULT 'personal',
  fingerprint text DEFAULT NULL,
  ip_addr inet DEFAULT NULL,
  extra_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  log_id uuid;
BEGIN
  INSERT INTO trial_usage_log (
    email,
    phone,
    user_id,
    trial_type,
    trial_tier,
    device_fingerprint,
    ip_address,
    metadata
  ) VALUES (
    user_email,
    user_phone,
    user_uuid,
    trial_kind,
    tier,
    fingerprint,
    ip_addr,
    extra_metadata
  )
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Trigger function to auto-log trial on profile creation
CREATE OR REPLACE FUNCTION auto_log_trial_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only log if is_trial is true
  IF NEW.is_trial = true THEN
    -- Get email from auth.users
    PERFORM log_trial_usage(
      user_email := (SELECT email FROM auth.users WHERE id = NEW.id),
      user_phone := NEW.phone,
      user_uuid := NEW.id,
      tier := COALESCE(NEW.trial_plan_tier, 'trial'),
      trial_kind := 'personal',
      extra_metadata := jsonb_build_object(
        'trial_end_date', NEW.trial_end_date,
        'signup_method', COALESCE(NEW.metadata->>'signup_method', 'unknown')
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Attach trigger to profiles table
DROP TRIGGER IF EXISTS trigger_auto_log_trial ON profiles;
CREATE TRIGGER trigger_auto_log_trial
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_log_trial_on_signup();

-- Function for signup flow to check trial eligibility
CREATE OR REPLACE FUNCTION check_trial_eligibility(
  user_email text,
  user_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  already_used boolean;
  trial_record record;
BEGIN
  -- Check if trial was used before
  already_used := has_used_trial(user_email, user_phone);
  
  IF already_used THEN
    -- Get the most recent trial record for details
    SELECT 
      trial_granted_at,
      trial_type,
      trial_tier
    INTO trial_record
    FROM trial_usage_log
    WHERE 
      email = user_email 
      OR (user_phone IS NOT NULL AND phone = user_phone)
    ORDER BY trial_granted_at DESC
    LIMIT 1;
    
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'trial_already_used',
      'previous_trial_date', trial_record.trial_granted_at,
      'previous_trial_type', trial_record.trial_type,
      'previous_trial_tier', trial_record.trial_tier
    );
  END IF;
  
  RETURN jsonb_build_object(
    'eligible', true,
    'reason', 'first_time_user'
  );
END;
$$;

COMMENT ON TABLE trial_usage_log IS 'Tracks trial usage to prevent abuse - persists even after account deletion';
COMMENT ON FUNCTION has_used_trial IS 'Check if email/phone has used trial before';
COMMENT ON FUNCTION log_trial_usage IS 'Log trial usage for tracking';
COMMENT ON FUNCTION check_trial_eligibility IS 'Check if user is eligible for trial based on email/phone history';
