-- Migration: Weekly Report & Cron Schedules
-- Purpose: Set up pg_cron jobs for:
--   1. Weekly progress reports (every Sunday 4 PM SAST / 2 PM UTC)
--   2. Fee reminders (1st and 15th of month at 8 AM SAST / 6 AM UTC)
--   3. Social media agent daily run (9 AM SAST / 7 AM UTC)
--   4. Event reminders (daily at 7 AM SAST / 5 AM UTC)
-- Date: 2026-02-10

-- Ensure pg_cron and pg_net extensions are available
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================
-- 1. Weekly Reports (every Sunday at 2 PM UTC = 4 PM SAST)
-- ============================================
SELECT cron.unschedule('weekly-report-generation')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-report-generation');

SELECT cron.schedule(
  'weekly-report-generation',
  '0 14 * * 0',  -- 2:00 PM UTC every Sunday (= 4:00 PM SAST)
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/weekly-report-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
    ),
    body := jsonb_build_object('scheduled', true, 'source', 'pg_cron')
  )
  $$
);

-- ============================================
-- 2. Fee Reminders (1st and 15th of month at 6 AM UTC = 8 AM SAST)
-- ============================================
SELECT cron.unschedule('fee-reminders-monthly')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fee-reminders-monthly');

SELECT cron.schedule(
  'fee-reminders-monthly',
  '0 6 1,15 * *',  -- 6:00 AM UTC on 1st and 15th
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/fee-reminders-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
    ),
    body := jsonb_build_object('scheduled', true, 'source', 'pg_cron')
  )
  $$
);

-- ============================================
-- 3. Social Media Agent (daily at 7 AM UTC = 9 AM SAST)
-- ============================================
SELECT cron.unschedule('social-agent-daily')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'social-agent-daily');

SELECT cron.schedule(
  'social-agent-daily',
  '0 7 * * *',  -- 7:00 AM UTC daily
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/social-agent-daily-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
    ),
    body := jsonb_build_object('scheduled', true, 'source', 'pg_cron')
  )
  $$
);

-- ============================================
-- 4. Event Reminders (daily at 5 AM UTC = 7 AM SAST)
-- ============================================
SELECT cron.unschedule('event-reminders-daily')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'event-reminders-daily');

SELECT cron.schedule(
  'event-reminders-daily',
  '0 5 * * *',  -- 5:00 AM UTC daily
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/event-reminders-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
    ),
    body := jsonb_build_object('scheduled', true, 'source', 'pg_cron')
  )
  $$
);

-- ============================================
-- 5. Social Publisher (every 2 hours for queued posts)
-- ============================================
SELECT cron.unschedule('social-publisher')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'social-publisher');

SELECT cron.schedule(
  'social-publisher',
  '0 */2 * * *',  -- Every 2 hours
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/social-publisher-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
    ),
    body := jsonb_build_object('scheduled', true, 'source', 'pg_cron')
  )
  $$
);

-- ============================================
-- Verification: List all scheduled jobs
-- ============================================
-- After applying this migration, verify with:
--   SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
-- Expected: birthday-reminders-daily, birthday-weekly-summary,
--           event-reminders-daily, fee-reminders-monthly,
--           social-agent-daily, social-publisher, weekly-report-generation
