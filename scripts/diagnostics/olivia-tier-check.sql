-- Run this in your shell:
-- psql -h aws-0-ap-southeast-1.pooler.supabase.com -p 6543 -U postgres.lvvvjywrmpcqrpvuptdi -d postgres -f scripts/diagnostics/olivia-tier-check.sql

\echo '=== PROFILES ==='
SELECT id, email, subscription_tier, is_trial, trial_end_date
FROM profiles
WHERE email = 'oliviamakunyane@gmail.com';

\echo ''
\echo '=== USER_AI_TIERS (billing tier) ==='
SELECT user_id, tier, organization_id
FROM user_ai_tiers
WHERE user_id = (SELECT id FROM profiles WHERE email = 'oliviamakunyane@gmail.com' LIMIT 1);

\echo ''
\echo '=== USER_AI_USAGE (capability tier - what ai-proxy reads) ==='
SELECT user_id, current_tier, chat_messages_today, exams_generated_this_month, updated_at
FROM user_ai_usage
WHERE user_id = (SELECT id FROM profiles WHERE email = 'oliviamakunyane@gmail.com' LIMIT 1);

\echo ''
\echo '=== AI_USAGE_LOGS (this month - what ai-proxy enforces) ==='
SELECT 
    COUNT(*) FILTER (WHERE status = 'success') AS success_count,
    COUNT(*) FILTER (WHERE status = 'error') AS error_count,
    COUNT(*) AS total_count
FROM ai_usage_logs
WHERE user_id = (SELECT id FROM profiles WHERE email = 'oliviamakunyane@gmail.com' LIMIT 1)
  AND service_type = 'dash_conversation'
  AND created_at >= date_trunc('month', now());
