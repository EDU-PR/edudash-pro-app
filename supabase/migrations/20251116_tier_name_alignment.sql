-- =====================================================
-- TIER NAME ALIGNMENT MIGRATION
-- Date: 2025-11-16
-- Purpose: Align database tier names with user-facing product names
-- =====================================================

-- =====================================================
-- 1. Create New Tier Enum with Product-Aligned Names
-- =====================================================

-- First, let's see what tiers exist currently
DO $$
BEGIN
  RAISE NOTICE '=== CURRENT TIER ANALYSIS ===';
  RAISE NOTICE 'Checking existing tier enum...';
END $$;

-- Create new enum type with aligned names
CREATE TYPE tier_name_aligned AS ENUM (
  'free',
  'trial',
  'parent_starter',      -- was 'basic' for parents
  'parent_plus',         -- was 'premium' for parents
  'teacher_starter',     -- was 'teacher_basic'
  'teacher_pro',         -- new tier for teachers
  'school_starter',      -- was 'starter' for schools
  'school_premium',      -- was 'premium' for schools
  'school_pro',          -- was 'pro' for schools
  'school_enterprise'    -- was 'enterprise' for schools
);

-- =====================================================
-- 2. Update ai_usage_tiers Table
-- =====================================================

-- Add temporary column with new enum type
ALTER TABLE ai_usage_tiers 
ADD COLUMN tier_name_new tier_name_aligned;

-- Map old tier names to new ones
UPDATE ai_usage_tiers
SET tier_name_new = CASE tier_name
  WHEN 'free' THEN 'free'::tier_name_aligned
  WHEN 'trial' THEN 'trial'::tier_name_aligned
  WHEN 'basic' THEN 'parent_starter'::tier_name_aligned
  WHEN 'premium' THEN 'parent_plus'::tier_name_aligned
  WHEN 'teacher_basic' THEN 'teacher_starter'::tier_name_aligned
  WHEN 'starter' THEN 'school_starter'::tier_name_aligned
  WHEN 'pro' THEN 'school_pro'::tier_name_aligned
  WHEN 'enterprise' THEN 'school_enterprise'::tier_name_aligned
  ELSE tier_name::tier_name_aligned
END;

-- Drop old column and rename new one
ALTER TABLE ai_usage_tiers DROP COLUMN tier_name;
ALTER TABLE ai_usage_tiers RENAME COLUMN tier_name_new TO tier_name;

-- Re-add unique constraint
ALTER TABLE ai_usage_tiers ADD UNIQUE (tier_name);

-- Update pricing for new tier structure
UPDATE ai_usage_tiers SET
  monthly_price_zar = 99.00,
  exams_per_month = 30,
  explanations_per_month = 100,
  chat_messages_per_day = 200
WHERE tier_name = 'parent_starter';

UPDATE ai_usage_tiers SET
  monthly_price_zar = 199.00,
  exams_per_month = 100,
  explanations_per_month = 500,
  chat_messages_per_day = 1000,
  priority_queue = true
WHERE tier_name = 'parent_plus';

-- Insert teacher tiers if they don't exist
INSERT INTO ai_usage_tiers (
  tier_name, 
  exams_per_month, 
  explanations_per_month, 
  chat_messages_per_day, 
  monthly_price_zar, 
  priority_queue,
  advanced_features
)
VALUES 
  (
    'teacher_starter', 
    100, 
    300, 
    500, 
    149.00, 
    false,
    true
  ),
  (
    'teacher_pro', 
    500, 
    1000, 
    2000, 
    299.00, 
    true,
    true
  )
ON CONFLICT (tier_name) DO UPDATE SET
  exams_per_month = EXCLUDED.exams_per_month,
  explanations_per_month = EXCLUDED.explanations_per_month,
  chat_messages_per_day = EXCLUDED.chat_messages_per_day,
  monthly_price_zar = EXCLUDED.monthly_price_zar,
  priority_queue = EXCLUDED.priority_queue,
  advanced_features = EXCLUDED.advanced_features;

-- Insert school tiers if they don't exist
INSERT INTO ai_usage_tiers (
  tier_name, 
  exams_per_month, 
  explanations_per_month, 
  chat_messages_per_day, 
  monthly_price_zar, 
  priority_queue,
  advanced_features
)
VALUES 
  (
    'school_starter', 
    999999, 
    999999, 
    999999, 
    299.00, 
    true,
    true
  ),
  (
    'school_premium', 
    999999, 
    999999, 
    999999, 
    499.00, 
    true,
    true
  ),
  (
    'school_pro', 
    999999, 
    999999, 
    999999, 
    899.00, 
    true,
    true
  ),
  (
    'school_enterprise', 
    999999, 
    999999, 
    999999, 
    1999.00, 
    true,
    true
  )
ON CONFLICT (tier_name) DO UPDATE SET
  exams_per_month = EXCLUDED.exams_per_month,
  explanations_per_month = EXCLUDED.explanations_per_month,
  chat_messages_per_day = EXCLUDED.chat_messages_per_day,
  monthly_price_zar = EXCLUDED.monthly_price_zar;

-- =====================================================
-- 3. Update user_ai_tiers Table
-- =====================================================

-- Check if the tier column in user_ai_tiers uses the old enum
DO $$
DECLARE
  v_column_type text;
BEGIN
  SELECT data_type INTO v_column_type
  FROM information_schema.columns
  WHERE table_name = 'user_ai_tiers'
    AND column_name = 'tier';
  
  RAISE NOTICE 'user_ai_tiers.tier column type: %', v_column_type;
END $$;

-- If user_ai_tiers.tier is using ai_model_tier enum, we need to update it
-- Add temporary column
ALTER TABLE user_ai_tiers 
ADD COLUMN tier_new tier_name_aligned;

-- Map existing user tiers to new names
UPDATE user_ai_tiers
SET tier_new = CASE tier
  WHEN 'free' THEN 'free'::tier_name_aligned
  WHEN 'trial' THEN 'trial'::tier_name_aligned
  WHEN 'basic' THEN 'parent_starter'::tier_name_aligned
  WHEN 'premium' THEN 'parent_plus'::tier_name_aligned
  WHEN 'teacher_basic' THEN 'teacher_starter'::tier_name_aligned
  WHEN 'starter' THEN 'school_starter'::tier_name_aligned
  WHEN 'pro' THEN 'school_pro'::tier_name_aligned
  WHEN 'enterprise' THEN 'school_enterprise'::tier_name_aligned
  ELSE 'free'::tier_name_aligned
END;

-- Drop old column and rename
ALTER TABLE user_ai_tiers DROP COLUMN tier;
ALTER TABLE user_ai_tiers RENAME COLUMN tier_new TO tier;

-- =====================================================
-- 4. Update user_ai_usage Table
-- =====================================================

-- Add temporary column
ALTER TABLE user_ai_usage 
ADD COLUMN current_tier_new tier_name_aligned;

-- Map existing usage tiers
UPDATE user_ai_usage
SET current_tier_new = CASE current_tier
  WHEN 'free' THEN 'free'::tier_name_aligned
  WHEN 'trial' THEN 'trial'::tier_name_aligned
  WHEN 'basic' THEN 'parent_starter'::tier_name_aligned
  WHEN 'premium' THEN 'parent_plus'::tier_name_aligned
  WHEN 'teacher_basic' THEN 'teacher_starter'::tier_name_aligned
  WHEN 'starter' THEN 'school_starter'::tier_name_aligned
  WHEN 'pro' THEN 'school_pro'::tier_name_aligned
  WHEN 'enterprise' THEN 'school_enterprise'::tier_name_aligned
  ELSE 'free'::tier_name_aligned
END;

-- Drop old and rename
ALTER TABLE user_ai_usage DROP COLUMN current_tier;
ALTER TABLE user_ai_usage RENAME COLUMN current_tier_new TO current_tier;

-- =====================================================
-- 5. Update subscription_plans Table (if exists)
-- =====================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'subscription_plans'
  ) THEN
    -- Update tier names in subscription_plans
    UPDATE subscription_plans
    SET tier = CASE tier
      WHEN 'basic' THEN 'parent_starter'
      WHEN 'premium' THEN 'parent_plus'
      WHEN 'starter' THEN 'school_starter'
      WHEN 'pro' THEN 'school_pro'
      WHEN 'enterprise' THEN 'school_enterprise'
      ELSE tier
    END;
    
    RAISE NOTICE 'Updated subscription_plans tier names';
  END IF;
END $$;

-- =====================================================
-- 6. Drop Old Enum (if safe)
-- =====================================================

-- Only drop if ai_model_tier enum exists and is no longer used
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_model_tier') THEN
    -- Check if enum is still in use
    DECLARE
      v_count integer;
    BEGIN
      SELECT count(*) INTO v_count
      FROM information_schema.columns
      WHERE udt_name = 'ai_model_tier';
      
      IF v_count = 0 THEN
        DROP TYPE ai_model_tier;
        RAISE NOTICE 'Dropped old ai_model_tier enum (no longer in use)';
      ELSE
        RAISE NOTICE 'ai_model_tier enum still in use by % columns', v_count;
      END IF;
    END;
  END IF;
END $$;

-- =====================================================
-- 7. Update Promotional Campaigns
-- =====================================================

-- Update the promotional campaigns to use new tier names
UPDATE promotional_campaigns
SET tier_filter = CASE 
  WHEN 'basic' = ANY(tier_filter) THEN 
    array_replace(tier_filter, 'basic', 'parent_starter')
  ELSE tier_filter
END;

UPDATE promotional_campaigns
SET tier_filter = CASE 
  WHEN 'premium' = ANY(tier_filter) THEN 
    array_replace(tier_filter, 'premium', 'parent_plus')
  ELSE tier_filter
END;

UPDATE promotional_campaigns
SET tier_filter = CASE 
  WHEN 'teacher_basic' = ANY(tier_filter) THEN 
    array_replace(tier_filter, 'teacher_basic', 'teacher_starter')
  ELSE tier_filter
END;

-- =====================================================
-- 8. Update User Promotional Subscriptions
-- =====================================================

UPDATE user_promotional_subscriptions
SET tier = CASE tier
  WHEN 'basic' THEN 'parent_starter'
  WHEN 'premium' THEN 'parent_plus'
  WHEN 'teacher_basic' THEN 'teacher_starter'
  WHEN 'starter' THEN 'school_starter'
  WHEN 'pro' THEN 'school_pro'
  WHEN 'enterprise' THEN 'school_enterprise'
  ELSE tier
END;

-- =====================================================
-- 9. Verification
-- =====================================================

DO $$
DECLARE
  tier_rec RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== TIER MIGRATION COMPLETE ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Updated Tier Structure:';
  
  FOR tier_rec IN 
    SELECT tier_name, monthly_price_zar, exams_per_month
    FROM ai_usage_tiers
    WHERE is_active = true
    ORDER BY monthly_price_zar
  LOOP
    RAISE NOTICE '  ✅ % - R%/month (% exams/month)', 
      tier_rec.tier_name, 
      tier_rec.monthly_price_zar,
      tier_rec.exams_per_month;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE 'User Distribution:';
  RAISE NOTICE '  Users with parent_starter: %', (SELECT count(*) FROM user_ai_tiers WHERE tier::text = 'parent_starter');
  RAISE NOTICE '  Users with parent_plus: %', (SELECT count(*) FROM user_ai_tiers WHERE tier::text = 'parent_plus');
  RAISE NOTICE '  Users with free tier: %', (SELECT count(*) FROM user_ai_tiers WHERE tier::text = 'free');
  RAISE NOTICE '';
END $$;

-- =====================================================
-- 10. Comments for Documentation
-- =====================================================

COMMENT ON TYPE tier_name_aligned IS 'Product-aligned tier names matching user-facing branding';
COMMENT ON TABLE ai_usage_tiers IS 'AI usage limits and pricing by tier - using product-aligned names (parent_starter, parent_plus, teacher_starter, school_*)';

