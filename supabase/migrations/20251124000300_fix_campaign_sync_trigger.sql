-- Fix campaign sync trigger to not use vault
-- The Edge Function will handle authentication via its own SUPABASE_SERVICE_ROLE_KEY env var

-- Drop old function
DROP FUNCTION IF EXISTS sync_campaign_to_edusite() CASCADE;

-- Create simplified trigger function that just calls the Edge Function
-- The Edge Function has its own service_role_key in environment variables
CREATE OR REPLACE FUNCTION sync_campaign_to_edusite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id int;
  payload jsonb;
BEGIN
  -- Build payload based on operation
  IF TG_OP = 'DELETE' THEN
    payload := jsonb_build_object(
      'operation', TG_OP,
      'old_record', row_to_json(OLD)
    );
  ELSE
    payload := jsonb_build_object(
      'operation', TG_OP,
      'record', row_to_json(NEW),
      'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END
    );
  END IF;

  -- Call Edge Function (it will use its own service_role_key from environment)
  SELECT INTO request_id net.http_post(
    url := 'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/sync-campaign-to-edusite',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := payload
  );

  RAISE NOTICE '[Campaign Sync] % operation synced to EduSitePro. Request ID: %', TG_OP, request_id;

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[Campaign Sync] Failed to sync: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_sync_campaign_to_edusite ON marketing_campaigns;
CREATE TRIGGER trigger_sync_campaign_to_edusite
  AFTER INSERT OR UPDATE OR DELETE ON marketing_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION sync_campaign_to_edusite();

COMMENT ON FUNCTION sync_campaign_to_edusite IS 'Syncs campaign changes to EduSitePro via Edge Function';
