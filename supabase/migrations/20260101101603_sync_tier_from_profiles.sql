-- Migration: Centralize tier management with profiles.subscription_tier as single source of truth
-- Purpose: When profiles.subscription_tier changes, automatically sync to user_ai_tiers, user_ai_usage
-- This eliminates fragmentation and ensures consistency across all tier-related tables

-- ============================================================================
-- TRIGGER FUNCTION: Sync tier from profiles to other tables
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_tier_from_profiles()
RETURNS TRIGGER AS $$
DECLARE
  v_tier_value TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Only proceed if subscription_tier actually changed
  IF OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier THEN
    v_tier_value := COALESCE(NEW.subscription_tier, 'free');
    
    -- Calculate expiration (30 days from now for paid tiers, NULL for free)
    IF v_tier_value = 'free' THEN
      v_expires_at := NULL;
    ELSE
      v_expires_at := NOW() + INTERVAL '30 days';
    END IF;
    
    -- Log the tier change
    RAISE LOG '[sync_tier_from_profiles] User % tier changed: % -> %', 
      NEW.id, OLD.subscription_tier, NEW.subscription_tier;
    
    -- ========================================================================
    -- 1. Sync to user_ai_tiers table
    -- ========================================================================
    INSERT INTO user_ai_tiers (user_id, tier, expires_at, updated_at)
    VALUES (NEW.id, v_tier_value::tier_name_aligned, v_expires_at, NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      tier = EXCLUDED.tier,
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW();
    
    -- ========================================================================
    -- 2. Sync to user_ai_usage table
    -- ========================================================================
    INSERT INTO user_ai_usage (user_id, current_tier, updated_at)
    VALUES (NEW.id, v_tier_value::tier_name_aligned, NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      current_tier = EXCLUDED.current_tier,
      updated_at = NOW();
    
    -- ========================================================================
    -- 3. Update auth.users metadata (for JWT claims on next login)
    -- Note: This uses raw_user_meta_data which is accessible via service role
    -- ========================================================================
    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
        jsonb_build_object('subscription_tier', v_tier_value)
    WHERE id = NEW.id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER: Fire after profiles.subscription_tier is updated
-- ============================================================================
DROP TRIGGER IF EXISTS trg_sync_tier_from_profiles ON profiles;

CREATE TRIGGER trg_sync_tier_from_profiles
  AFTER UPDATE OF subscription_tier ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_tier_from_profiles();

-- Also trigger on INSERT to handle new users with non-free tiers
DROP TRIGGER IF EXISTS trg_sync_tier_from_profiles_insert ON profiles;

CREATE TRIGGER trg_sync_tier_from_profiles_insert
  AFTER INSERT ON profiles
  FOR EACH ROW
  WHEN (NEW.subscription_tier IS NOT NULL AND NEW.subscription_tier <> 'free')
  EXECUTE FUNCTION sync_tier_from_profiles();

-- ============================================================================
-- COMMENT: Document the single source of truth pattern
-- ============================================================================
COMMENT ON COLUMN profiles.subscription_tier IS 
  'SINGLE SOURCE OF TRUTH for user tier. Updates here auto-sync to user_ai_tiers, user_ai_usage, and auth.users metadata via trigger.';

COMMENT ON TRIGGER trg_sync_tier_from_profiles ON profiles IS
  'Syncs subscription_tier changes to user_ai_tiers, user_ai_usage, and auth.users.raw_user_meta_data';

-- ============================================================================
-- INITIAL SYNC: Populate user_ai_tiers and user_ai_usage from profiles
-- For users who have a subscription_tier set but missing records
-- ============================================================================
INSERT INTO user_ai_tiers (user_id, tier, updated_at)
SELECT 
  p.id,
  COALESCE(p.subscription_tier, 'free')::tier_name_aligned,
  NOW()
FROM profiles p
WHERE NOT EXISTS (SELECT 1 FROM user_ai_tiers u WHERE u.user_id = p.id)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO user_ai_usage (user_id, current_tier, updated_at)
SELECT 
  p.id,
  COALESCE(p.subscription_tier, 'free')::tier_name_aligned,
  NOW()
FROM profiles p
WHERE NOT EXISTS (SELECT 1 FROM user_ai_usage u WHERE u.user_id = p.id)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- GRANT: Ensure the function can update auth.users
-- ============================================================================
GRANT UPDATE ON auth.users TO postgres;
