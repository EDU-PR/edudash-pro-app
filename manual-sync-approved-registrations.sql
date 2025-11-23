-- Run this in EduDashPro database to manually trigger the sync for existing approved registrations
-- This will create parent accounts in EduSitePro for all approved registrations

DO $$
DECLARE
  reg RECORD;
  result TEXT;
  supabase_url TEXT := 'https://lvvvjywrmpcqrpvuptdi.supabase.co';
  service_key TEXT := 'your-service-role-key-here'; -- Replace with actual key
BEGIN
  FOR reg IN 
    SELECT * FROM registration_requests 
    WHERE status = 'approved' 
    AND edusite_id IS NOT NULL
  LOOP
    -- Call the Edge Function to sync this registration
    SELECT net.http_post(
      url := supabase_url || '/functions/v1/sync-approval-to-edusite',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'record', to_jsonb(reg),
        'old_record', jsonb_build_object('status', 'pending')
      )
    ) INTO result;
    
    RAISE NOTICE 'Synced registration % (%) - Result: %', 
      reg.id, reg.guardian_email, result;
  END LOOP;
  
  RAISE NOTICE 'Completed sync of all approved registrations';
END $$;
