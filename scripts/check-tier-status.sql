-- Check User Tier Status by Email
-- Usage: 
--   1. Replace 'EMAIL_HERE' below with the user's email address
--   2. Run in Supabase SQL Editor: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/editor
--   3. Or via psql: psql -h aws-0-ap-southeast-1.pooler.supabase.com -p 6543 -U postgres.lvvvjywrmpcqrpvuptdi -d postgres -f scripts/check-tier-status.sql

-- Set the email to check (change this line)
\set user_email 'dipsroboticsgm@gmail.com'

-- 1. Find user in auth.users
SELECT 
    '=== USER INFO ===' as section,
    id as user_id,
    email,
    created_at,
    email_confirmed_at
FROM auth.users
WHERE email = :'user_email'
LIMIT 1;

-- 2. Check user_ai_usage.current_tier
SELECT 
    '=== USER AI USAGE ===' as section,
    user_id,
    current_tier,
    exams_generated_this_month,
    explanations_requested_this_month,
    chat_messages_today,
    updated_at
FROM public.user_ai_usage
WHERE user_id = (
    SELECT id FROM auth.users WHERE email = :'user_email' LIMIT 1
);

-- 3. Check user_ai_tiers.tier
SELECT 
    '=== USER AI TIERS ===' as section,
    user_id,
    tier,
    created_at,
    updated_at
FROM public.user_ai_tiers
WHERE user_id = (
    SELECT id FROM auth.users WHERE email = :'user_email' LIMIT 1
);

-- 4. Check payment_transactions
SELECT 
    '=== PAYMENT TRANSACTIONS ===' as section,
    id,
    status,
    tier,
    amount,
    currency,
    completed_at,
    created_at,
    metadata->>'scope' as scope,
    metadata->>'plan_tier' as plan_tier
FROM public.payment_transactions
WHERE user_id = (
    SELECT id FROM auth.users WHERE email = :'user_email' LIMIT 1
)
ORDER BY created_at DESC
LIMIT 5;

-- 5. Summary
SELECT 
    '=== SUMMARY ===' as section,
    COALESCE(
        (SELECT current_tier FROM public.user_ai_usage WHERE user_id = (SELECT id FROM auth.users WHERE email = :'user_email' LIMIT 1)),
        (SELECT tier FROM public.user_ai_tiers WHERE user_id = (SELECT id FROM auth.users WHERE email = :'user_email' LIMIT 1)),
        'free'
    ) as effective_tier,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.payment_transactions 
            WHERE user_id = (SELECT id FROM auth.users WHERE email = :'user_email' LIMIT 1)
            AND status = 'completed' 
            AND tier IS NOT NULL
        ) THEN 'Has completed payment'
        ELSE 'No completed payment found'
    END as payment_status;

