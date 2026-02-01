-- Sync marketing_campaigns changes to EduSitePro via Edge Function (pg_net)

DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_net;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping pg_net extension creation: insufficient privilege';
  END;
END $$;

CREATE OR REPLACE FUNCTION public.sync_campaign_to_edusite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  request_id int;
  payload jsonb;
BEGIN
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

  SELECT INTO request_id net.http_post(
    url := 'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/sync-campaign-to-edusite',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := payload
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[Campaign Sync] Failed to sync: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trigger_sync_campaign_to_edusite ON public.marketing_campaigns;
CREATE TRIGGER trigger_sync_campaign_to_edusite
AFTER INSERT OR UPDATE OR DELETE ON public.marketing_campaigns
FOR EACH ROW EXECUTE FUNCTION public.sync_campaign_to_edusite();
