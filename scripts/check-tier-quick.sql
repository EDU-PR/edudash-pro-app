-- Quick Tier Status Check
-- Usage: Replace 'EMAIL_HERE' with user email and run in Supabase SQL Editor

WITH user_info AS (
  SELECT id, email, created_at 
  FROM auth.users 
  WHERE email = 'dipsroboticsgm@gmail.com'  -- CHANGE THIS EMAIL
  LIMIT 1
),
tier_info AS (
  SELECT 
    (SELECT current_tier FROM user_ai_usage WHERE user_id = (SELECT id FROM user_info)) as usage_tier,
    (SELECT tier FROM user_ai_tiers WHERE user_id = (SELECT id FROM user_info)) as tiers_tier,
    (SELECT COUNT(*) FROM payment_transactions 
     WHERE user_id = (SELECT id FROM user_info) AND status = 'completed') as completed_payments
)
SELECT 
  ui.email,
  ui.id as user_id,
  ui.created_at as user_created,
  COALESCE(ti.usage_tier, ti.tiers_tier, 'free') as effective_tier,
  ti.usage_tier as from_user_ai_usage,
  ti.tiers_tier as from_user_ai_tiers,
  ti.completed_payments,
  CASE 
    WHEN ti.completed_payments > 0 AND COALESCE(ti.usage_tier, ti.tiers_tier, 'free') = 'free' 
    THEN '⚠️ WARNING: Payment completed but tier still free!'
    WHEN ti.completed_payments > 0 AND COALESCE(ti.usage_tier, ti.tiers_tier, 'free') != 'free'
    THEN '✅ Tier correctly updated'
    ELSE 'ℹ️ No completed payments found'
  END as status
FROM user_info ui
CROSS JOIN tier_info ti;

