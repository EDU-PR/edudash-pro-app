-- Quick diagnostic query to check your tier status
-- Run this in Supabase SQL Editor

-- Replace 'oliviamakunyane@gmail.com' with your actual email if different
WITH user_info AS (
  SELECT id FROM profiles WHERE email = 'oliviamakunyane@gmail.com' LIMIT 1
)
SELECT 
  'user_ai_usage' as table_name,
  user_id,
  current_tier,
  exams_generated_this_month,
  chat_messages_today,
  updated_at
FROM user_ai_usage
WHERE user_id = (SELECT id FROM user_info)

UNION ALL

SELECT 
  'user_ai_tiers' as table_name,
  user_id,
  tier as current_tier,
  NULL as exams_generated_this_month,
  NULL as chat_messages_today,
  updated_at
FROM user_ai_tiers
WHERE user_id = (SELECT id FROM user_info)

UNION ALL

SELECT 
  'profiles' as table_name,
  id as user_id,
  CASE WHEN is_trial THEN 'TRIAL' ELSE 'NOT_TRIAL' END as current_tier,
  NULL,
  NULL,
  updated_at
FROM profiles
WHERE id = (SELECT id FROM user_info);

-- Also check recent AI usage logs
SELECT 
  service_type,
  COUNT(*) as count,
  MAX(created_at) as last_used
FROM ai_usage_logs
WHERE user_id = (SELECT id FROM profiles WHERE email = 'oliviamakunyane@gmail.com' LIMIT 1)
  AND created_at >= DATE_TRUNC('month', NOW())
GROUP BY service_type
ORDER BY last_used DESC;
