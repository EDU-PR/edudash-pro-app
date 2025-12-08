-- Check actual usage counts to see if quota is genuinely exceeded
\echo '=== MONTHLY USAGE FOR OLIVIA ==='

SELECT 
    service_type,
    COUNT(*) FILTER (WHERE status = 'success') AS success_count,
    COUNT(*) FILTER (WHERE status = 'error') AS error_count,
    COUNT(*) AS total_requests,
    MIN(created_at) AS first_request,
    MAX(created_at) AS last_request
FROM ai_usage_logs
WHERE user_id = (SELECT id FROM profiles WHERE email = 'oliviamakunyane@gmail.com' LIMIT 1)
  AND created_at >= date_trunc('month', now())
GROUP BY service_type
ORDER BY service_type;

\echo ''
\echo '=== PARENT_PLUS QUOTA LIMITS ==='
\echo 'dash_conversation: 1000/month'
\echo 'lesson_generation: 100/month'
\echo 'homework_help: 100/month'
\echo 'grading_assistance: 100/month'
