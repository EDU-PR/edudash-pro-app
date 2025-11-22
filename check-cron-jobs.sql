-- First, let's check if the job was created
SELECT jobid, schedule, command, active 
FROM cron.job 
WHERE jobname = 'sync-registrations-every-5-min';

-- If you need to update or recreate it, first unschedule:
-- SELECT cron.unschedule('sync-registrations-every-5-min');
