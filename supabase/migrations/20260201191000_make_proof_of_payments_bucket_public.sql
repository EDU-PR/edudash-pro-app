-- Ensure proof-of-payments bucket is public so public URLs work

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RAISE NOTICE 'Skipping bucket update: storage.buckets missing';
    RETURN;
  END IF;

  BEGIN
    UPDATE storage.buckets
    SET public = true
    WHERE id = 'proof-of-payments';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping bucket update: insufficient privilege';
  END;
END $$;
