-- Add payment_for_month to POP uploads to separate billing period from transaction date
BEGIN;

ALTER TABLE public.pop_uploads
  ADD COLUMN IF NOT EXISTS payment_for_month date;

-- Backfill existing records (previously payment_date represented the period)
UPDATE public.pop_uploads
SET payment_for_month = payment_date
WHERE payment_for_month IS NULL
  AND payment_date IS NOT NULL;

-- Ensure helper columns align with billing period when available
UPDATE public.pop_uploads
SET payment_year = EXTRACT(YEAR FROM payment_for_month)::int,
    payment_month = EXTRACT(MONTH FROM payment_for_month)::int
WHERE payment_for_month IS NOT NULL;

-- Update duplicate check to use payment_for_month when present
CREATE OR REPLACE FUNCTION public.check_duplicate_pop_upload()
RETURNS TRIGGER AS $$
DECLARE
  v_period_date date;
BEGIN
  v_period_date := COALESCE(NEW.payment_for_month, NEW.payment_date);

  IF NEW.payment_for_month IS NULL AND NEW.payment_date IS NOT NULL THEN
    NEW.payment_for_month := NEW.payment_date;
  END IF;

  IF v_period_date IS NOT NULL THEN
    NEW.payment_year := EXTRACT(YEAR FROM v_period_date)::int;
    NEW.payment_month := EXTRACT(MONTH FROM v_period_date)::int;
  END IF;

  IF NEW.status IN ('pending', 'approved') THEN
    IF EXISTS (
      SELECT 1
      FROM public.pop_uploads
      WHERE student_id = NEW.student_id
        AND payment_year = NEW.payment_year
        AND payment_month = NEW.payment_month
        AND COALESCE(description, '') = COALESCE(NEW.description, '')
        AND status IN ('pending', 'approved')
        AND id != NEW.id
    ) THEN
      RAISE EXCEPTION 'A payment upload already exists for this month for this category. Please wait for it to be reviewed or contact the school.'
        USING HINT = format('student_id: %s, payment_month: %s-%s, description: %s', NEW.student_id, NEW.payment_year, NEW.payment_month, COALESCE(NEW.description, ''));
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
