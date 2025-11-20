-- Manual tier fix for parent_plus subscription
-- Run this in Supabase SQL Editor if webhook didn't update properly

-- Replace with your actual email
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get user ID
  SELECT id INTO v_user_id 
  FROM profiles 
  WHERE email = 'oliviamakunyane@gmail.com' 
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found with email: oliviamakunyane@gmail.com';
  END IF;

  -- Update user_ai_tiers with product tier
  INSERT INTO user_ai_tiers (user_id, tier, assigned_reason, is_active, updated_at)
  VALUES (
    v_user_id,
    'parent_plus',
    'Manual fix after PayFast payment',
    true,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET 
    tier = 'parent_plus',
    is_active = true,
    assigned_reason = 'Manual fix after PayFast payment',
    updated_at = NOW();

  -- Update user_ai_usage with capability tier (THIS IS CRITICAL for quota checks)
  INSERT INTO user_ai_usage (user_id, current_tier, updated_at)
  VALUES (
    v_user_id,
    'premium',  -- This is the capability tier that quota checker uses
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET 
    current_tier = 'premium',
    updated_at = NOW();

  -- Disable trial
  UPDATE profiles
  SET is_trial = false
  WHERE id = v_user_id;

  RAISE NOTICE 'Successfully updated tiers for user %', v_user_id;
  RAISE NOTICE 'user_ai_tiers.tier = parent_plus (product tier)';
  RAISE NOTICE 'user_ai_usage.current_tier = premium (capability tier for AI gating)';
  RAISE NOTICE 'profiles.is_trial = false';
END $$;
