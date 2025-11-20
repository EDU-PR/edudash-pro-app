#!/bin/bash
# Tier diagnostic for oliviamakunyane@gmail.com
# Run this in your shell where SUPABASE_DB_PASSWORD is exported

set -e

if [ -z "$SUPABASE_DB_PASSWORD" ]; then
    echo "❌ SUPABASE_DB_PASSWORD not set"
    echo "Export it first: export SUPABASE_DB_PASSWORD='your-password'"
    exit 1
fi

echo "🔍 Checking tier status for oliviamakunyane@gmail.com"
echo ""

PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
    -h aws-0-ap-southeast-1.pooler.supabase.com \
    -p 6543 \
    -U postgres.lvvvjywrmpcqrpvuptdi \
    -d postgres <<'SQL'

-- Profile tier
SELECT '=== PROFILES ===' AS section;
SELECT id, email, subscription_tier, is_trial, trial_end_date
FROM profiles
WHERE email = 'oliviamakunyane@gmail.com';

-- Product tier (billing)
SELECT '' AS blank, '=== USER_AI_TIERS (billing tier) ===' AS section;
SELECT user_id, tier, organization_id
FROM user_ai_tiers
WHERE user_id = (SELECT id FROM profiles WHERE email = 'oliviamakunyane@gmail.com' LIMIT 1);

-- Capability tier (what ai-proxy reads)
SELECT '' AS blank, '=== USER_AI_USAGE (capability tier) ===' AS section;
SELECT user_id, current_tier, chat_messages_today, exams_generated_this_month, updated_at
FROM user_ai_usage
WHERE user_id = (SELECT id FROM profiles WHERE email = 'oliviamakunyane@gmail.com' LIMIT 1);

-- Monthly usage (what ai-proxy enforces)
SELECT '' AS blank, '=== AI_USAGE_LOGS (this month) ===' AS section;
SELECT 
    COUNT(*) FILTER (WHERE status = 'success') AS success_count,
    COUNT(*) FILTER (WHERE status = 'error') AS error_count,
    COUNT(*) AS total_count
FROM ai_usage_logs
WHERE user_id = (SELECT id FROM profiles WHERE email = 'oliviamakunyane@gmail.com' LIMIT 1)
  AND service_type = 'dash_conversation'
  AND created_at >= date_trunc('month', now());

SQL
