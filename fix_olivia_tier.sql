-- Fix tier for oliviamakunyane@gmail.com
-- Convert from parent_plus (underscore) to parent-plus (hyphen)

-- First, let's find the user
DO $$
DECLARE
  v_user_id UUID;
  v_email TEXT := 'oliviamakunyane@gmail.com';
BEGIN
  -- Get user ID from auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_email;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User not found: %', v_email;
    RETURN;
  END IF;
  
  RAISE NOTICE 'Found user: % with ID: %', v_email, v_user_id;
  
  -- Update user_ai_tiers
  UPDATE user_ai_tiers
  SET tier = 'parent-plus'
  WHERE user_id = v_user_id;
  
  RAISE NOTICE 'Updated user_ai_tiers for user: %', v_user_id;
  
  -- Update user_ai_usage (if it exists and has current_tier column)
  UPDATE user_ai_usage
  SET current_tier = 'parent-plus'
  WHERE user_id = v_user_id;
  
  RAISE NOTICE 'Updated user_ai_usage for user: %', v_user_id;
  
  -- Show current state
  RAISE NOTICE 'Current user_ai_tiers state:';
  PERFORM tier FROM user_ai_tiers WHERE user_id = v_user_id;
  
END $$;

-- Verify the update
SELECT 
  u.email,
  uat.tier as user_ai_tier,
  uau.current_tier as usage_tier
FROM auth.users u
LEFT JOIN user_ai_tiers uat ON u.id = uat.user_id
LEFT JOIN user_ai_usage uau ON u.id = uau.user_id
WHERE u.email = 'oliviamakunyane@gmail.com';
