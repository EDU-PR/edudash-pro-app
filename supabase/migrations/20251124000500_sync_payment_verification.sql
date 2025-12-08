-- Sync payment verification back to EduSitePro
-- When payment_verified changes in EduDashPro, sync it to EduSitePro

CREATE OR REPLACE FUNCTION trigger_sync_payment_to_edusite()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  request_id bigint;
BEGIN
  -- Only trigger on payment_verified change
  IF (TG_OP = 'UPDATE' AND 
      OLD.payment_verified IS DISTINCT FROM NEW.payment_verified) THEN
    
    -- Call Edge Function to sync payment status to EduSitePro
    SELECT INTO request_id net.http_post(
      url := 'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/sync-payment-to-edusite',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'record', to_jsonb(NEW),
        'old_record', to_jsonb(OLD)
      )
    );
    
    RAISE NOTICE '[Payment Sync] Payment verification changed to % for registration %. Request ID: %', NEW.payment_verified, NEW.id, request_id;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[Payment Sync] Failed to sync: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Create trigger on registration_requests table
DROP TRIGGER IF EXISTS on_payment_verification_sync_to_edusite ON registration_requests;
CREATE TRIGGER on_payment_verification_sync_to_edusite
  AFTER UPDATE ON registration_requests
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_payment_to_edusite();

COMMENT ON TRIGGER on_payment_verification_sync_to_edusite ON registration_requests IS 
'Automatically syncs payment verification status back to EduSitePro';
