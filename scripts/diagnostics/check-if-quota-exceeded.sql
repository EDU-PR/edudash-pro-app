-- Check if Olivia has genuinely exceeded quota this month
\echo '=== ACTUAL USAGE THIS MONTH ==='

WITH monthly_usage AS (
  SELECT 
    COUNT(*) FILTER (WHERE status = 'success') AS success_count,
    COUNT(*) FILTER (WHERE status = 'error') AS error_count,
    COUNT(*) AS total_count
  FROM ai_usage_logs
  WHERE user_id = (SELECT id FROM profiles WHERE email = 'oliviamakunyane@gmail.com' LIMIT 1)
    AND service_type = 'dash_conversation'
    AND created_at >= date_trunc('month', now())
)
SELECT 
  success_count,
  error_count,
  total_count,
  CASE 
    WHEN success_count >= 1000 THEN '❌ EXCEEDED (parent_plus limit: 1000)'
    WHEN success_count >= 800 THEN '⚠️  WARNING (80% of quota used)'
    ELSE '✅ OK (under quota)'
  END AS status
FROM monthly_usage;

\echo ''
\echo 'If EXCEEDED: Either reset counters or wait until next month'
\echo 'If OK: The ai-proxy tier detection may still be cached - check logs'
