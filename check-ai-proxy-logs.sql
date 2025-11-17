-- Check recent ai-proxy Edge Function execution logs
-- This queries the Edge Function execution logs from Supabase

-- Check recent ai_events logs for user
SELECT 
  created_at,
  event_type,
  metadata->>'service_type' as service_type,
  metadata->>'status_code' as status_code,
  metadata->>'tier' as tier,
  metadata->>'error' as error,
  metadata->'quota_check' as quota_check,
  metadata
FROM ai_events
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'oliviamakunyane@gmail.com')
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 20;

-- Check ai_usage_logs for recent chat attempts
SELECT 
  created_at,
  service_type,
  tier,
  tokens_in,
  tokens_out,
  cost,
  metadata->>'model' as model,
  metadata->>'error' as error
FROM ai_usage_logs
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'oliviamakunyane@gmail.com')
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 10;

-- Check current quota status
SELECT 
  tier,
  quota_limit,
  quota_used,
  quota_remaining,
  current_tier,
  tier_changed_at
FROM user_ai_usage
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'oliviamakunyane@gmail.com');
