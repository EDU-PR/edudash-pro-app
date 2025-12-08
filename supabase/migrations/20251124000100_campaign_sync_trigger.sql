-- =====================================================
-- CAMPAIGN SYNC: EduDashPro → EduSitePro
-- Auto-sync marketing campaigns when created/updated/deleted
-- =====================================================

-- 1. Create trigger function
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_sync_campaign_to_edusite()
RETURNS TRIGGER AS $$
DECLARE
  request_id bigint;
  service_role_key text;
  edudash_function_url text;
BEGIN
  -- Get service role key from vault
  SELECT decrypted_secret INTO service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  -- EduDashPro Edge Function URL
  edudash_function_url := 'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/sync-campaign-to-edusite';

  -- Call Edge Function to sync to EduSitePro
  SELECT INTO request_id
    net.http_post(
      url := edudash_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'type', TG_OP,
        'table', TG_TABLE_NAME,
        'schema', TG_TABLE_SCHEMA,
        'record', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE row_to_json(NEW) END,
        'old_record', CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END
      )
    );

  -- Log the sync attempt
  RAISE NOTICE '[Campaign Sync] % operation synced to EduSitePro. Request ID: %', TG_OP, request_id;

  -- Return appropriate value based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create trigger on marketing_campaigns
-- =====================================================
DROP TRIGGER IF EXISTS sync_campaign_to_edusite ON marketing_campaigns;

CREATE TRIGGER sync_campaign_to_edusite
  AFTER INSERT OR UPDATE OR DELETE ON marketing_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_campaign_to_edusite();

-- 3. Grant permissions
-- =====================================================
GRANT EXECUTE ON FUNCTION trigger_sync_campaign_to_edusite() TO service_role;

-- 4. Comments
-- =====================================================
COMMENT ON FUNCTION trigger_sync_campaign_to_edusite() IS 
  'Triggers campaign sync from EduDashPro to EduSitePro via Edge Function';

COMMENT ON TRIGGER sync_campaign_to_edusite ON marketing_campaigns IS
  'Auto-sync campaigns to EduSitePro when created, updated, or deleted';
