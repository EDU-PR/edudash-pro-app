-- Migration: Birthday Reminders Cron Schedule
-- Purpose: Set up pg_cron job to trigger birthday reminders daily at 6 AM
-- Date: 2026-01-20

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the birthday reminders cron to run daily at 6:00 AM (SAST - UTC+2)
-- 4:00 AM UTC = 6:00 AM SAST (South African Standard Time)
-- The function calls the birthday-reminders-cron Edge Function via HTTP
SELECT cron.schedule(
  'birthday-reminders-daily',  -- Job name
  '0 4 * * *',                 -- Cron expression: 4:00 AM UTC daily
  $$
  SELECT net.http_post(
    url := 'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/birthday-reminders-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
    ),
    body := jsonb_build_object('scheduled', true, 'source', 'pg_cron')
  )
  $$
);

-- Also schedule a weekly birthday summary on Sunday at 7 AM (5 AM UTC)
-- This gives teachers/principals a heads-up for the week ahead
SELECT cron.schedule(
  'birthday-weekly-summary',   -- Job name
  '0 5 * * 0',                 -- Cron expression: 5:00 AM UTC every Sunday
  $$
  SELECT net.http_post(
    url := 'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/birthday-reminders-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
    ),
    body := jsonb_build_object('scheduled', true, 'source', 'pg_cron', 'weekSummary', true)
  )
  $$
);

-- Add comment for documentation
COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL - used for birthday reminders and other scheduled tasks';