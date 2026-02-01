-- Ensure registration fee structures are set to R200 for future registrations

DO $$
BEGIN
  IF to_regclass('public.fee_structures') IS NOT NULL THEN
    UPDATE public.fee_structures
    SET amount = 200
    WHERE fee_type = 'registration'
      AND amount IS DISTINCT FROM 200;
  END IF;
END $$;
