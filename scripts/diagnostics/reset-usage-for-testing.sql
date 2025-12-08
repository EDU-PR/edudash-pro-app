-- DANGEROUS: Reset monthly usage counter for testing
-- Only use this if you need to test quota system with a clean slate
-- Run this in your shell where PGPASSWORD is exported

\echo '⚠️  WARNING: This will delete all ai_usage_logs for this month'
\echo ''
\prompt 'Type YES to confirm: ' confirm

\if :'confirm' = 'YES'
  DELETE FROM ai_usage_logs
  WHERE user_id = (SELECT id FROM profiles WHERE email = 'oliviamakunyane@gmail.com' LIMIT 1)
    AND created_at >= date_trunc('month', now());
  
  \echo '✅ Usage logs deleted for this month'
  \echo ''
  \echo 'Remaining logs:'
  
  SELECT COUNT(*) as remaining_logs
  FROM ai_usage_logs
  WHERE user_id = (SELECT id FROM profiles WHERE email = 'oliviamakunyane@gmail.com' LIMIT 1);
\else
  \echo '❌ Cancelled - no changes made'
\endif
