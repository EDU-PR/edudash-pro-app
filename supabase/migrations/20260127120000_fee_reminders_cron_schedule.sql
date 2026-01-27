-- Migration: Fee Reminders Cron Schedule
-- Purpose: Trigger fee reminder notifications daily
-- Date: 2026-01-27

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule fee reminders to run daily at 5:00 AM UTC (7:00 AM SAST)
SELECT cron.schedule(
  'fee-reminders-daily',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url := 'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/fee-reminders-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
    ),
    body := jsonb_build_object('scheduled', true, 'source', 'pg_cron')
  )
  $$
);
