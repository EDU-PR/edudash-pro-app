-- Fix Olivia's tier from parent_plus to parent-plus
-- Email: oliviamakunyane@gmail.com

-- Step 1: Find user ID
SELECT id, email, raw_user_meta_data->>'full_name' as name 
FROM auth.users 
WHERE email = 'oliviamakunyane@gmail.com';

-- Step 2: Update user_ai_tiers
UPDATE user_ai_tiers 
SET tier = 'parent-plus'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'oliviamakunyane@gmail.com'
);

-- Step 3: Check current tier in user_ai_usage (this table might be auto-updated by trigger)
SELECT user_id, current_tier, updated_at
FROM user_ai_usage
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'oliviamakunyane@gmail.com'
);

-- Step 4: Update user_ai_usage manually if needed
UPDATE user_ai_usage
SET current_tier = 'parent-plus',
    updated_at = NOW()
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'oliviamakunyane@gmail.com'
);

-- Step 5: Verify the updates
SELECT 
  u.email,
  t.tier as ai_tier,
  usg.current_tier as usage_tier,
  s.status as subscription_status,
  sp.name as plan_name
FROM auth.users u
LEFT JOIN user_ai_tiers t ON u.id = t.user_id
LEFT JOIN user_ai_usage usg ON u.id = usg.user_id
LEFT JOIN subscriptions s ON s.metadata->>'owner_user_id' = u.id::text
LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
WHERE u.email = 'oliviamakunyane@gmail.com';
