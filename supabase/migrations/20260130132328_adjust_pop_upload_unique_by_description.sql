-- ==========================================================================
-- Allow multiple POP uploads per month when description differs
-- ==========================================================================

BEGIN;

-- Drop old unique index (student_id + month) if it exists
DROP INDEX IF EXISTS idx_pop_uploads_unique_month;

-- Ensure helper columns exist for month uniqueness (immutable-friendly)
ALTER TABLE public.pop_uploads
  ADD COLUMN IF NOT EXISTS payment_year integer,
  ADD COLUMN IF NOT EXISTS payment_month integer;

-- Backfill month columns for existing rows
UPDATE public.pop_uploads
SET payment_year = EXTRACT(YEAR FROM payment_date)::int,
    payment_month = EXTRACT(MONTH FROM payment_date)::int
WHERE payment_date IS NOT NULL
  AND (payment_year IS NULL OR payment_month IS NULL);

-- Create new unique index that also scopes by description
CREATE UNIQUE INDEX IF NOT EXISTS idx_pop_uploads_unique_month_desc
ON public.pop_uploads (
  student_id,
  payment_year,
  payment_month,
  COALESCE(description, '')
)
WHERE status IN ('pending', 'approved')
  AND payment_year IS NOT NULL
  AND payment_month IS NOT NULL;

COMMENT ON INDEX idx_pop_uploads_unique_month_desc IS
'Prevents duplicate POP uploads for the same student in the same month for the same description when status is pending or approved.';

-- Update duplicate check function to include description and set year/month
CREATE OR REPLACE FUNCTION public.check_duplicate_pop_upload()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_date IS NOT NULL THEN
    NEW.payment_year := EXTRACT(YEAR FROM NEW.payment_date)::int;
    NEW.payment_month := EXTRACT(MONTH FROM NEW.payment_date)::int;
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
