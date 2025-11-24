-- =====================================================
-- CAMPAIGN SYNC TRIGGER (EduDashPro → EduSitePro)
-- Auto-sync campaigns when created/updated/deleted
-- =====================================================

-- Function to sync campaign to EduSitePro
CREATE OR REPLACE FUNCTION sync_campaign_to_edusite()
RETURNS TRIGGER AS $$
DECLARE
  v_service_key TEXT;
  v_function_url TEXT;
  v_response JSONB;
BEGIN
  -- Get service role key from vault
  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF v_service_key IS NULL THEN
    RAISE WARNING 'Service role key not found in vault';
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Set function URL
  v_function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/sync-campaign-to-edusite';

  -- Call Edge Function based on operation
  IF TG_OP = 'DELETE' THEN
    PERFORM net.http_post(
      url := v_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body := jsonb_build_object(
        'operation', 'DELETE',
        'campaign', jsonb_build_object('id', OLD.id)
      )
    );
    RETURN OLD;
  ELSE
    PERFORM net.http_post(
      url := v_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body := jsonb_build_object(
        'operation', TG_OP,
        'campaign', row_to_json(NEW)
      )
    );
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_sync_campaign_to_edusite ON marketing_campaigns;
CREATE TRIGGER trigger_sync_campaign_to_edusite
  AFTER INSERT OR UPDATE OR DELETE ON marketing_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION sync_campaign_to_edusite();

COMMENT ON FUNCTION sync_campaign_to_edusite() IS 'Syncs campaign changes from EduDashPro to EduSitePro';
COMMENT ON TRIGGER trigger_sync_campaign_to_edusite ON marketing_campaigns IS 'Auto-sync campaigns to EduSitePro on changes';
