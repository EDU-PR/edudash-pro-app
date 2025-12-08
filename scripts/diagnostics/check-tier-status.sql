-- Diagnostics: Verify a user's AI tier and usage across tables
-- How to use:
--   1) Replace EMAIL_HERE with the target user's email
--   2) Run in Supabase SQL Editor or psql
--
-- Notes:
--   - ai-proxy enforces quotas per month using ai_usage_logs
--   - UI quota bar may use daily counters (user_ai_usage.chat_messages_today)
--   - Tiers may appear as 'parent-plus' (hyphen) or 'parent_plus' (underscore);
--     the proxy now normalizes both. This script shows raw DB values.

-- >>>> CHANGE THIS EMAIL <<<<
\set user_email 'EMAIL_HERE'

WITH target AS (
  SELECT id AS user_id, email, preschool_id, organization_id
  FROM profiles
  WHERE email = :user_email
  LIMIT 1
)

-- Profile snapshot
SELECT 'profiles' AS src,
       p.id AS user_id,
       p.email,
       COALESCE(p.organization_id, p.preschool_id) AS org_id,
       p.subscription_tier,
       p.is_trial,
       p.trial_end_date,
       p.trial_plan_tier
FROM profiles p
JOIN target t ON p.id = t.user_id;

-- Product/billing tier (what plan the user is on)
SELECT 'user_ai_tiers' AS src,
       uat.user_id,
       uat.tier
FROM user_ai_tiers uat
JOIN target t ON uat.user_id = t.user_id;

-- Capability tier + daily counters
SELECT 'user_ai_usage' AS src,
       uau.user_id,
       uau.current_tier,
       uau.chat_messages_today,
       uau.exams_generated_this_month,
       uau.explanations_requested_this_month,
       uau.updated_at
FROM user_ai_usage uau
JOIN target t ON uau.user_id = t.user_id;

-- Monthly usage that the ai-proxy enforces (service_type specific)
WITH month_bounds AS (
  SELECT date_trunc('month', now()) AS month_start
)
SELECT 'ai_usage_logs_month' AS src,
       l.user_id,
       SUM(CASE WHEN l.status = 'success' THEN 1 ELSE 0 END) AS successes,
       SUM(CASE WHEN l.status = 'error' THEN 1 ELSE 0 END) AS errors,
       COUNT(*) AS total_requests,
       MIN(l.created_at) AS first_log_in_month,
       MAX(l.created_at) AS last_log_in_month
FROM ai_usage_logs l
JOIN target t ON l.user_id = t.user_id
JOIN month_bounds mb ON l.created_at >= mb.month_start
WHERE l.service_type = 'dash_conversation'
GROUP BY l.user_id;

-- Optional: Daily breakdown for the last 7 days
WITH last7 AS (
  SELECT generate_series::date AS day
  FROM generate_series(now() - interval '6 days', now(), interval '1 day')
)
SELECT 'ai_usage_logs_daily' AS src,
       d.day,
       COALESCE(SUM(CASE WHEN l.status = 'success' THEN 1 ELSE 0 END), 0) AS successes,
       COALESCE(SUM(CASE WHEN l.status = 'error' THEN 1 ELSE 0 END), 0) AS errors,
       COALESCE(COUNT(l.id), 0) AS total
FROM last7 d
LEFT JOIN ai_usage_logs l
  ON l.created_at::date = d.day
LEFT JOIN target t ON l.user_id = t.user_id
WHERE l.service_type = 'dash_conversation'
   OR l.id IS NULL
GROUP BY d.day
ORDER BY d.day;