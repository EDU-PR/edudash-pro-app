-- Normalize registration fee amounts to R200 for accounting alignment

DO $$
BEGIN
  IF to_regclass('public.registration_requests') IS NOT NULL THEN
    UPDATE public.registration_requests
    SET registration_fee_amount = 200
    WHERE registration_fee_amount IS DISTINCT FROM 200;
  END IF;

  IF to_regclass('public.child_registration_requests') IS NOT NULL THEN
    UPDATE public.child_registration_requests
    SET registration_fee_amount = 200
    WHERE registration_fee_amount IS DISTINCT FROM 200;
  END IF;

  IF to_regclass('public.students') IS NOT NULL THEN
    UPDATE public.students
    SET registration_fee_amount = 200
    WHERE registration_fee_amount IS DISTINCT FROM 200;
  END IF;

END $$;
