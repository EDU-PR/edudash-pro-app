-- Fix approval sync trigger to not use vault
-- The Edge Function will handle authentication via its own environment variables

DROP FUNCTION IF EXISTS trigger_sync_approval_to_edusite() CASCADE;

CREATE OR REPLACE FUNCTION trigger_sync_approval_to_edusite()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  request_id bigint;
BEGIN
  -- Only trigger on status change to approved/rejected/waitlisted
  IF (TG_OP = 'UPDATE' AND 
      OLD.status IS DISTINCT FROM NEW.status AND 
      NEW.status IN ('approved', 'rejected', 'waitlisted')) THEN
    
    -- Call Edge Function (it will use its own credentials from environment)
    SELECT INTO request_id net.http_post(
      url := 'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/sync-approval-to-edusite',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'record', to_jsonb(NEW),
        'old_record', to_jsonb(OLD)
      )
    );
    
    RAISE NOTICE '[Approval Sync] Status changed to % for registration %. Request ID: %', NEW.status, NEW.id, request_id;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[Approval Sync] Failed to sync: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_registration_approval_sync_to_edusite ON registration_requests;
CREATE TRIGGER on_registration_approval_sync_to_edusite
  AFTER UPDATE ON registration_requests
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_approval_to_edusite();

COMMENT ON TRIGGER on_registration_approval_sync_to_edusite ON registration_requests IS 
'Automatically syncs registration approvals/rejections back to EduSitePro and creates parent accounts';
