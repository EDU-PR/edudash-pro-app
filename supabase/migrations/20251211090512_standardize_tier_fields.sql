-- Migration: Standardize tier field names across all tables
-- Uses subscription_tier as the canonical field name
-- Phase 1: Database Schema Standardization (Critical Priority)

BEGIN;

-- Step 1: Ensure organizations table has subscription_tier (primary field)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'subscription_tier'
  ) THEN
    ALTER TABLE organizations ADD COLUMN subscription_tier TEXT;
    COMMENT ON COLUMN organizations.subscription_tier IS 'Canonical subscription tier field';
  END IF;
END $$;

-- Step 2: Migrate plan_tier to subscription_tier in organizations if plan_tier exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'plan_tier'
  ) THEN
    UPDATE organizations 
    SET subscription_tier = plan_tier 
    WHERE subscription_tier IS NULL AND plan_tier IS NOT NULL;
    
    COMMENT ON COLUMN organizations.plan_tier IS 'DEPRECATED: Use subscription_tier instead. Kept for backward compatibility.';
  END IF;
END $$;

-- Step 3: Ensure preschools table uses subscription_tier
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'preschools' AND column_name = 'subscription_tier'
  ) THEN
    ALTER TABLE preschools ADD COLUMN subscription_tier TEXT;
    COMMENT ON COLUMN preschools.subscription_tier IS 'Organization subscription tier';
  END IF;
END $$;

-- Step 4: Create unified tier lookup function
CREATE OR REPLACE FUNCTION get_user_subscription_tier(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  tier_value TEXT;
  org_id UUID;
BEGIN
  -- Priority order for tier lookup:
  -- 1. user_ai_usage.current_tier (user-level override)
  -- 2. user_ai_tiers.tier (user-specific tier)
  -- 3. organization.subscription_tier (organization tier)
  -- 4. Default to 'free'
  
  -- Check user_ai_usage first (highest priority - user override)
  SELECT current_tier INTO tier_value
  FROM user_ai_usage
  WHERE user_id = get_user_subscription_tier.user_id
  AND current_tier IS NOT NULL
  LIMIT 1;
  
  IF tier_value IS NOT NULL THEN
    RETURN tier_value;
  END IF;
  
  -- Check user_ai_tiers (user-specific tier)
  SELECT tier INTO tier_value
  FROM user_ai_tiers
  WHERE user_id = get_user_subscription_tier.user_id
  AND tier IS NOT NULL
  LIMIT 1;
  
  IF tier_value IS NOT NULL THEN
    RETURN tier_value;
  END IF;
  
  -- Get user's organization
  SELECT get_user_organization_id(get_user_subscription_tier.user_id) INTO org_id;
  
  IF org_id IS NOT NULL THEN
    -- Check organization subscription_tier
    SELECT subscription_tier INTO tier_value
    FROM organizations
    WHERE id = org_id
    AND subscription_tier IS NOT NULL;
    
    IF tier_value IS NOT NULL THEN
      RETURN tier_value;
    END IF;
    
    -- Fallback to plan_tier if it exists
    SELECT plan_tier INTO tier_value
    FROM organizations
    WHERE id = org_id
    AND plan_tier IS NOT NULL;
    
    IF tier_value IS NOT NULL THEN
      RETURN tier_value;
    END IF;
    
    -- Check preschools table for backward compatibility
    SELECT subscription_tier INTO tier_value
    FROM preschools
    WHERE id = org_id::TEXT
    AND subscription_tier IS NOT NULL;
    
    IF tier_value IS NOT NULL THEN
      RETURN tier_value;
    END IF;
  END IF;
  
  -- Default to free tier
  RETURN 'free';
END;
$$;

COMMENT ON FUNCTION get_user_subscription_tier IS 'Get user subscription tier with priority: user_ai_usage > user_ai_tiers > organization > default(free)';

-- Step 5: Create helper function to check tier access
CREATE OR REPLACE FUNCTION has_tier_access(user_id UUID, required_tier TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  user_tier TEXT;
  tier_levels JSONB := '{"free": 0, "starter": 1, "premium": 2, "enterprise": 3}'::JSONB;
  user_level INT;
  required_level INT;
BEGIN
  user_tier := get_user_subscription_tier(user_id);
  
  -- Get numeric levels for comparison
  user_level := COALESCE((tier_levels->>user_tier)::INT, 0);
  required_level := COALESCE((tier_levels->>required_tier)::INT, 0);
  
  RETURN user_level >= required_level;
END;
$$;

COMMENT ON FUNCTION has_tier_access IS 'Check if user has access to features requiring a specific tier level';

-- Step 6: Create view for unified tier information
CREATE OR REPLACE VIEW user_subscription_info AS
SELECT 
  p.id as user_id,
  p.role,
  COALESCE(p.organization_id, p.preschool_id) as organization_id,
  get_user_subscription_tier(p.id) as subscription_tier,
  uau.current_tier as user_tier_override,
  uat.tier as user_specific_tier,
  o.subscription_tier as org_subscription_tier,
  o.plan_tier as org_plan_tier_legacy,
  p.seat_status,
  CASE 
    WHEN p.seat_status = 'active' THEN true
    ELSE false
  END as has_active_seat
FROM profiles p
LEFT JOIN user_ai_usage uau ON p.id = uau.user_id
LEFT JOIN user_ai_tiers uat ON p.id = uat.user_id
LEFT JOIN organizations o ON COALESCE(p.organization_id, p.preschool_id) = o.id;

COMMENT ON VIEW user_subscription_info IS 'Comprehensive view of user subscription and tier information';

-- Step 7: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_organizations_subscription_tier ON organizations(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_preschools_subscription_tier ON preschools(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_user_ai_usage_current_tier ON user_ai_usage(current_tier);
CREATE INDEX IF NOT EXISTS idx_user_ai_tiers_tier ON user_ai_tiers(tier);

COMMIT;


