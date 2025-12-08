-- Migration: Add sync triggers for unverify and delete actions
-- Description: Syncs payment unverification and registration deletion to EduSitePro

-- Function to sync payment unverification to EduSitePro
CREATE OR REPLACE FUNCTION trigger_sync_unverify_to_edusite()
RETURNS TRIGGER AS $$
DECLARE
  function_url text;
BEGIN
  -- Only sync if payment_verified changed from true to false
  IF OLD.payment_verified = true AND NEW.payment_verified = false THEN
    -- Get the Edge Function URL
    function_url := current_setting('app.supabase_url', true) || '/functions/v1/sync-unverify-to-edusite';
    
    -- Call the Edge Function asynchronously
    PERFORM net.http_post(
      url := function_url,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('record', to_jsonb(NEW))
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for payment unverification
DROP TRIGGER IF EXISTS on_payment_unverify_sync_to_edusite ON registration_requests;
CREATE TRIGGER on_payment_unverify_sync_to_edusite
  AFTER UPDATE OF payment_verified ON registration_requests
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_unverify_to_edusite();

-- Function to sync registration deletion to EduSitePro
CREATE OR REPLACE FUNCTION trigger_sync_delete_to_edusite()
RETURNS TRIGGER AS $$
DECLARE
  function_url text;
BEGIN
  -- Get the Edge Function URL
  function_url := current_setting('app.supabase_url', true) || '/functions/v1/sync-delete-to-edusite';
  
  -- Call the Edge Function asynchronously
  PERFORM net.http_post(
    url := function_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('old_record', to_jsonb(OLD))
  );
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for registration deletion
DROP TRIGGER IF EXISTS on_registration_delete_sync_to_edusite ON registration_requests;
CREATE TRIGGER on_registration_delete_sync_to_edusite
  BEFORE DELETE ON registration_requests
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_delete_to_edusite();

COMMENT ON FUNCTION trigger_sync_unverify_to_edusite() IS 'Syncs payment unverification from EduDash to EduSite';
COMMENT ON FUNCTION trigger_sync_delete_to_edusite() IS 'Syncs registration deletion from EduDash to EduSite';
