-- Auto-sync registration approval/rejection back to EduSitePro
-- When a registration status changes to 'approved', 'rejected', or 'waitlisted' in EduDashPro,
-- this trigger automatically syncs it back to EduSitePro and creates parent account

CREATE OR REPLACE FUNCTION trigger_sync_approval_to_edusite()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  request_id bigint;
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Only trigger on status change to approved/rejected/waitlisted
  IF (TG_OP = 'UPDATE' AND 
      OLD.status IS DISTINCT FROM NEW.status AND 
      NEW.status IN ('approved', 'rejected', 'waitlisted')) THEN
    
    -- Get credentials from vault or use hardcoded values
    -- You can also use: SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url'
    supabase_url := 'https://lvvvjywrmpcqrpvuptdi.supabase.co';
    
    -- Get service role key from vault
    SELECT decrypted_secret INTO service_key 
    FROM vault.decrypted_secrets 
    WHERE name = 'service_role_key'
    LIMIT 1;
    
    -- Fallback if vault doesn't have the key (you'll need to add it via Supabase dashboard)
    IF service_key IS NULL THEN
      RAISE WARNING 'Service role key not found in vault. Edge function will not be called.';
      RETURN NEW;
    END IF;
    
    -- Call Edge Function to sync back to EduSitePro
    PERFORM
      net.http_post(
        url := supabase_url || '/functions/v1/sync-approval-to-edusite',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body := jsonb_build_object(
          'record', to_jsonb(NEW),
          'old_record', to_jsonb(OLD)
        )
      );
    
    RAISE NOTICE 'Triggered sync-approval-to-edusite for registration %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on registration_requests table
DROP TRIGGER IF EXISTS on_registration_approval_sync_to_edusite ON registration_requests;
CREATE TRIGGER on_registration_approval_sync_to_edusite
  AFTER UPDATE ON registration_requests
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_approval_to_edusite();

COMMENT ON TRIGGER on_registration_approval_sync_to_edusite ON registration_requests IS 
'Automatically syncs registration approvals/rejections back to EduSitePro and creates parent accounts';
