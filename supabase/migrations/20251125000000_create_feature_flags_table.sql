-- =====================================================================
-- Feature Flags Table
-- =====================================================================
-- Creates feature_flags table for managing feature availability by tier
-- =====================================================================

-- Create feature_flags table
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  tier_restrictions JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read feature flags
CREATE POLICY "Anyone can read feature flags"
  ON feature_flags
  FOR SELECT
  USING (true);

-- Insert TTS feature flag
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
  enabled = EXCLUDED.enabled,
  tier_restrictions = EXCLUDED.tier_restrictions,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

COMMENT ON TABLE feature_flags IS 'Feature flags for tier-based feature availability';
COMMENT ON COLUMN feature_flags.tier_restrictions IS 'JSONB object with tier-specific settings (free, trial, basic, premium, school)';
COMMENT ON COLUMN feature_flags.metadata IS 'Additional feature configuration (languages, voices, costs, etc.)';
