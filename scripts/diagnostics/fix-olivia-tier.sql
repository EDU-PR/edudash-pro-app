-- Run this in your shell:
-- psql -h aws-0-ap-southeast-1.pooler.supabase.com -p 6543 -U postgres.lvvvjywrmpcqrpvuptdi -d postgres -f scripts/diagnostics/fix-olivia-tier.sql

\echo '🔧 Fixing tier for oliviamakunyane@gmail.com'
\echo ''

-- Update product/billing tier
UPDATE user_ai_tiers
SET tier = 'parent-plus'
WHERE user_id = (SELECT id FROM profiles WHERE email = 'oliviamakunyane@gmail.com' LIMIT 1);

-- Update capability tier (what ai-proxy reads)
UPDATE user_ai_usage
SET current_tier = 'parent_plus',
    updated_at = now()
WHERE user_id = (SELECT id FROM profiles WHERE email = 'oliviamakunyane@gmail.com' LIMIT 1);

\echo '✅ Tiers updated'
\echo ''
\echo 'Verifying...'

SELECT id, email, subscription_tier FROM profiles WHERE email = 'oliviamakunyane@gmail.com';
SELECT user_id, tier FROM user_ai_tiers WHERE user_id = (SELECT id FROM profiles WHERE email = 'oliviamakunyane@gmail.com' LIMIT 1);
SELECT user_id, current_tier FROM user_ai_usage WHERE user_id = (SELECT id FROM profiles WHERE email = 'oliviamakunyane@gmail.com' LIMIT 1);
