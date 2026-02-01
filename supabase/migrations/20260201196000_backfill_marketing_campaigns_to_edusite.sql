-- Backfill existing marketing_campaigns to EduSitePro via Edge Function

DO $$
DECLARE
  rec record;
  request_id int;
BEGIN
  IF to_regclass('public.marketing_campaigns') IS NULL THEN
    RAISE NOTICE 'Skipping campaign backfill: marketing_campaigns not found';
    RETURN;
  END IF;

  FOR rec IN SELECT * FROM public.marketing_campaigns WHERE promo_code IS NOT NULL LOOP
    BEGIN
      SELECT INTO request_id net.http_post(
        url := 'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/sync-campaign-to-edusite',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object('operation', 'INSERT', 'record', row_to_json(rec))
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[Campaign Backfill] Failed to sync %: %', rec.id, SQLERRM;
    END;
  END LOOP;
END $$;
