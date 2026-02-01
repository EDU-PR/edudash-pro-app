-- Force a full marketing_campaigns re-sync to EduSitePro

DO $$
DECLARE
  request_id int;
BEGIN
  IF to_regclass('public.marketing_campaigns') IS NULL THEN
    RAISE NOTICE 'Skipping campaign full sync: marketing_campaigns not found';
    RETURN;
  END IF;

  SELECT INTO request_id net.http_post(
    url := 'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/sync-campaign-to-edusite',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('operation', 'FULL_SYNC')
  );
END $$;
