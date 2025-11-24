-- Fix unverify and delete triggers to use hardcoded Supabase URL
-- Issue: current_setting('app.supabase_url') returns NULL causing trigger failures

-- Fix unverify trigger
DROP FUNCTION IF EXISTS trigger_sync_unverify_to_edusite() CASCADE;

CREATE OR REPLACE FUNCTION trigger_sync_unverify_to_edusite()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  request_id bigint;
BEGIN
  -- Only sync if payment_verified changed from true to false
  IF OLD.payment_verified = true AND NEW.payment_verified = false THEN
    
    -- Call Edge Function with hardcoded URL
    SELECT INTO request_id net.http_post(
      url := 'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/sync-unverify-to-edusite',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'record', to_jsonb(NEW),
        'old_record', to_jsonb(OLD)
      )
    );
    
    RAISE NOTICE '[Unverify Sync] Payment unverified for registration %. Request ID: %', NEW.id, request_id;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[Unverify Sync] Failed to sync: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Recreate unverify trigger
DROP TRIGGER IF EXISTS on_payment_unverify_sync_to_edusite ON registration_requests;
CREATE TRIGGER on_payment_unverify_sync_to_edusite
  AFTER UPDATE OF payment_verified ON registration_requests
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_unverify_to_edusite();

-- Fix delete trigger
DROP FUNCTION IF EXISTS trigger_sync_delete_to_edusite() CASCADE;

CREATE OR REPLACE FUNCTION trigger_sync_delete_to_edusite()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  request_id bigint;
BEGIN
  -- Call Edge Function with hardcoded URL
  SELECT INTO request_id net.http_post(
    url := 'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/sync-delete-to-edusite',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'old_record', to_jsonb(OLD)
    )
  );
  
  RAISE NOTICE '[Delete Sync] Registration deleted: %. Request ID: %', OLD.id, request_id;
  
  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[Delete Sync] Failed to sync: %', SQLERRM;
  RETURN OLD;
END;
$$;

-- Recreate delete trigger
DROP TRIGGER IF EXISTS on_registration_delete_sync_to_edusite ON registration_requests;
CREATE TRIGGER on_registration_delete_sync_to_edusite
  BEFORE DELETE ON registration_requests
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_delete_to_edusite();

COMMENT ON FUNCTION trigger_sync_unverify_to_edusite() IS 'Syncs payment unverification from EduDash to EduSite';
COMMENT ON FUNCTION trigger_sync_delete_to_edusite() IS 'Syncs registration deletion from EduDash to EduSite';
COMMENT ON TRIGGER on_payment_unverify_sync_to_edusite ON registration_requests IS 
'Automatically syncs payment unverification back to EduSitePro';
COMMENT ON TRIGGER on_registration_delete_sync_to_edusite ON registration_requests IS 
'Automatically syncs registration deletion back to EduSitePro';

-- Success message
DO $$ 
BEGIN 
    RAISE NOTICE '✅ Fixed unverify and delete triggers with hardcoded Supabase URL';
    RAISE NOTICE '🔗 URL: https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/';
    RAISE NOTICE '📝 Both triggers now have error handling and will not block operations';
END $$;
