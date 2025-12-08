-- =====================================================================
-- TTS Feature Implementation
-- =====================================================================
-- Adds Text-to-Speech support with tier-based quotas
-- =====================================================================

-- Ensure voice_usage_logs table exists with proper structure
CREATE TABLE IF NOT EXISTS voice_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID REFERENCES preschools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  service TEXT NOT NULL CHECK (service IN ('tts', 'stt', 'voice_call')),
  provider TEXT NOT NULL CHECK (provider IN ('azure', 'google', 'device')),
  language_code TEXT NOT NULL,
  units INTEGER NOT NULL DEFAULT 0, -- characters for TTS, seconds for STT
  cost_estimate_usd DECIMAL(10,4) DEFAULT 0,
  latency_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_voice_usage_user_date ON voice_usage_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_usage_service ON voice_usage_logs(service, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_usage_preschool ON voice_usage_logs(preschool_id, created_at DESC);

-- Enable RLS
ALTER TABLE voice_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can view their own usage
CREATE POLICY "Users can view own voice usage"
  ON voice_usage_logs
  FOR SELECT
  USING (user_id = auth.uid());

-- Service role can insert usage logs
CREATE POLICY "Service role can insert voice usage"
  ON voice_usage_logs
  FOR INSERT
  WITH CHECK (true);

-- Add TTS feature to feature_flags if not exists
INSERT INTO feature_flags (
  feature_key,
  display_name,
  description,
  enabled,
  tier_restrictions,
  metadata
) VALUES (
  'tts_enabled',
  'Text-to-Speech',
  'High-quality AI voice synthesis for explanations and content',
  true,
  jsonb_build_object(
    'free', jsonb_build_object('enabled', true, 'daily_limit', 3),
    'trial', jsonb_build_object('enabled', true, 'daily_limit', 20),
    'basic', jsonb_build_object('enabled', true, 'daily_limit', 50),
    'premium', jsonb_build_object('enabled', true, 'daily_limit', 200),
    'school', jsonb_build_object('enabled', true, 'daily_limit', 1000)
  ),
  jsonb_build_object(
    'languages', ARRAY['en', 'af', 'zu', 'xh', 'nso'],
    'voices', jsonb_build_object(
      'en', ARRAY['en-ZA-LeahNeural', 'en-ZA-LukeNeural'],
      'af', ARRAY['af-ZA-AdriNeural', 'af-ZA-WillemNeural'],
      'zu', ARRAY['zu-ZA-ThandoNeural', 'zu-ZA-ThembaNeural']
    ),
    'cache_enabled', true,
    'cost_per_1m_chars', 16.0
  )
)
ON CONFLICT (feature_key) DO UPDATE SET
  enabled = true,
  tier_restrictions = EXCLUDED.tier_restrictions,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- Function to get user's daily TTS usage
CREATE OR REPLACE FUNCTION get_daily_tts_usage(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  usage_count INTEGER;
  today_start TIMESTAMPTZ;
BEGIN
  today_start := DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC');
  
  SELECT COUNT(*)
  INTO usage_count
  FROM voice_usage_logs
  WHERE user_id = p_user_id
    AND service = 'tts'
    AND created_at >= today_start
    AND success = true;
  
  RETURN COALESCE(usage_count, 0);
END;
$$;

-- Function to check TTS quota
CREATE OR REPLACE FUNCTION check_tts_quota(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_tier TEXT;
  daily_limit INTEGER;
  current_usage INTEGER;
  remaining INTEGER;
BEGIN
  -- Get user's tier
  SELECT tier INTO user_tier
  FROM user_ai_tiers
  WHERE user_id = p_user_id
  LIMIT 1;
  
  IF user_tier IS NULL THEN
    user_tier := 'free';
  END IF;
  
  -- Get tier limits
  CASE user_tier
    WHEN 'school' THEN daily_limit := 1000;
    WHEN 'premium' THEN daily_limit := 200;
    WHEN 'basic' THEN daily_limit := 50;
    WHEN 'trial' THEN daily_limit := 20;
    ELSE daily_limit := 3;
  END CASE;
  
  -- Get current usage
  current_usage := get_daily_tts_usage(p_user_id);
  remaining := GREATEST(0, daily_limit - current_usage);
  
  RETURN jsonb_build_object(
    'allowed', remaining > 0,
    'remaining', remaining,
    'limit', daily_limit,
    'tier', user_tier,
    'current_usage', current_usage
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_daily_tts_usage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_tts_quota(UUID) TO authenticated;

COMMENT ON TABLE voice_usage_logs IS 'Tracks TTS/STT usage for cost monitoring and quota enforcement';
COMMENT ON FUNCTION get_daily_tts_usage(UUID) IS 'Returns user daily TTS request count';
COMMENT ON FUNCTION check_tts_quota(UUID) IS 'Checks if user can make TTS request based on tier limits';
