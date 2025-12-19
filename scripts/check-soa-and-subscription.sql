-- Check SOA codes and user subscription status
-- Run this in Supabase SQL Editor or via psql

\set user_email 'dipsroboticsgm@gmail.com'

-- ============================================================================
-- 1. Check for SOA codes in courses
-- ============================================================================
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '📚 SOA COURSES'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
  c.id,
  c.title,
  c.course_code,
  c.is_active,
  c.created_at,
  o.id as organization_id,
  o.name as organization_name,
  o.slug as organization_slug
FROM courses c
LEFT JOIN organizations o ON c.organization_id = o.id
WHERE 
  UPPER(c.course_code) LIKE '%SOA%'
  OR UPPER(c.title) LIKE '%SOA%'
  OR (o.name IS NOT NULL AND UPPER(o.name) LIKE '%SOA%')
ORDER BY c.created_at DESC;

-- ============================================================================
-- 2. Check for SOA in organizations
-- ============================================================================
\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '🏢 SOA ORGANIZATIONS'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
  id,
  name,
  slug,
  type,
  status,
  created_at
FROM organizations
WHERE 
  UPPER(name) LIKE '%SOA%'
  OR UPPER(slug) LIKE '%SOA%'
ORDER BY created_at DESC;

-- ============================================================================
-- 3. Get user information
-- ============================================================================
\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '👤 USER INFORMATION'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
  id,
  email,
  created_at,
  email_confirmed_at
FROM auth.users
WHERE email = :'user_email';

-- ============================================================================
-- 4. Check user_ai_usage (current tier)
-- ============================================================================
\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '📊 USER AI USAGE (CURRENT TIER)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
  current_tier,
  exams_generated_this_month,
  explanations_requested_this_month,
  chat_messages_today,
  updated_at
FROM user_ai_usage
WHERE user_id = (SELECT id FROM auth.users WHERE email = :'user_email' LIMIT 1);

-- ============================================================================
-- 5. Check user_ai_tiers
-- ============================================================================
\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '🎯 USER AI TIERS'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
  tier,
  created_at,
  updated_at
FROM user_ai_tiers
WHERE user_id = (SELECT id FROM auth.users WHERE email = :'user_email' LIMIT 1);

-- ============================================================================
-- 6. Check payment_transactions
-- ============================================================================
\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '💳 PAYMENT TRANSACTIONS'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
  id,
  status,
  tier,
  amount,
  currency,
  subscription_plan_id,
  completed_at,
  created_at,
  metadata->>'plan_tier' as plan_tier,
  metadata->>'scope' as scope
FROM payment_transactions
WHERE user_id = (SELECT id FROM auth.users WHERE email = :'user_email' LIMIT 1)
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- 7. Check subscriptions table (if exists)
-- ============================================================================
\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '📋 SUBSCRIPTIONS'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
  id,
  user_id,
  tier,
  status,
  amount,
  payment_method,
  payment_id,
  pf_payment_id,
  subscription_start,
  subscription_end,
  next_billing_date,
  cancelled_at,
  created_at
FROM subscriptions
WHERE user_id = (SELECT id FROM auth.users WHERE email = :'user_email' LIMIT 1)
ORDER BY created_at DESC;

-- ============================================================================
-- 8. SUMMARY
-- ============================================================================
\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '📊 SUMMARY'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

WITH user_info AS (
  SELECT id, email FROM auth.users WHERE email = :'user_email' LIMIT 1
),
user_usage AS (
  SELECT current_tier FROM user_ai_usage 
  WHERE user_id = (SELECT id FROM user_info)
),
user_tiers AS (
  SELECT tier FROM user_ai_tiers 
  WHERE user_id = (SELECT id FROM user_info)
),
completed_payments AS (
  SELECT COUNT(*) as count, 
         STRING_AGG(DISTINCT tier, ', ') as tiers
  FROM payment_transactions
  WHERE user_id = (SELECT id FROM user_info)
    AND status = 'completed'
),
soa_courses_count AS (
  SELECT COUNT(*) as count
  FROM courses c
  LEFT JOIN organizations o ON c.organization_id = o.id
  WHERE 
    UPPER(c.course_code) LIKE '%SOA%'
    OR UPPER(c.title) LIKE '%SOA%'
    OR (o.name IS NOT NULL AND UPPER(o.name) LIKE '%SOA%')
),
soa_orgs_count AS (
  SELECT COUNT(*) as count
  FROM organizations
  WHERE 
    UPPER(name) LIKE '%SOA%'
    OR UPPER(slug) LIKE '%SOA%'
)
SELECT 
  (SELECT email FROM user_info) as user_email,
  COALESCE(
    (SELECT current_tier FROM user_usage),
    (SELECT tier FROM user_tiers),
    'free'
  ) as effective_tier,
  (SELECT count FROM completed_payments) as completed_payments_count,
  (SELECT tiers FROM completed_payments) as payment_tiers,
  (SELECT count FROM soa_courses_count) as soa_courses_found,
  (SELECT count FROM soa_orgs_count) as soa_orgs_found,
  CASE
    WHEN COALESCE(
      (SELECT current_tier FROM user_usage),
      (SELECT tier FROM user_tiers),
      'free'
    ) != 'free' THEN '✅ User has active subscription'
    WHEN (SELECT count FROM completed_payments) > 0 THEN '⚠️  WARNING: Completed payments but tier is FREE!'
    ELSE 'ℹ️  User is on free tier (no active subscription)'
  END as status;

