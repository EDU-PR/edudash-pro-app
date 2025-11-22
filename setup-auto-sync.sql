-- Enable pg_cron extension for scheduled jobs
create extension if not exists pg_cron;

-- Schedule the registration sync to run every 5 minutes
-- This will call the Edge Function automatically
select cron.schedule(
    'sync-registrations-every-5-min',  -- Job name
    '*/5 * * * *',                      -- Every 5 minutes (cron format)
    $$
    select
      net.http_post(
        url:='https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/sync-registrations-from-edusite',
        headers:=jsonb_build_object(
          'Content-Type','application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body:='{}'::jsonb
      ) as request_id;
    $$
);

-- View all scheduled jobs
-- SELECT * FROM cron.job;

-- To unschedule/delete this job later, run:
-- SELECT cron.unschedule('sync-registrations-every-5-min');
