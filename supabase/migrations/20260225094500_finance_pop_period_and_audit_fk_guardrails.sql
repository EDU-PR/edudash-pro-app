-- Finance guardrails:
-- 1) Keep fee correction audit rows even when a student fee row is deleted.
-- 2) Enforce POP period fields so approval/admin dashboards can match by billing month reliably.

DO $$
DECLARE
  v_fk_name text;
BEGIN
  IF to_regclass('public.fee_corrections_audit') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.fee_corrections_audit
    ALTER COLUMN student_fee_id DROP NOT NULL;

  SELECT tc.constraint_name
  INTO v_fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'fee_corrections_audit'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'student_fee_id'
  LIMIT 1;

  IF v_fk_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.fee_corrections_audit DROP CONSTRAINT %I',
      v_fk_name
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fee_corrections_audit_student_fee_id_fkey'
      AND conrelid = 'public.fee_corrections_audit'::regclass
  ) THEN
    ALTER TABLE public.fee_corrections_audit
      ADD CONSTRAINT fee_corrections_audit_student_fee_id_fkey
      FOREIGN KEY (student_fee_id)
      REFERENCES public.student_fees(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

UPDATE public.pop_uploads
SET
  payment_date = coalesce(payment_date, created_at::date, current_date),
  payment_for_month = date_trunc('month', coalesce(payment_for_month, payment_date, created_at::date, current_date)::timestamp)::date
WHERE upload_type = 'proof_of_payment'
  AND (
    payment_date IS NULL
    OR payment_for_month IS NULL
    OR payment_for_month <> date_trunc('month', payment_for_month::timestamp)::date
  );

CREATE OR REPLACE FUNCTION public.sync_pop_upload_finance_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.upload_type = 'proof_of_payment' THEN
    IF NEW.payment_date IS NULL THEN
      NEW.payment_date := current_date;
    END IF;

    IF NEW.payment_for_month IS NULL THEN
      NEW.payment_for_month := NEW.payment_date;
    END IF;

    NEW.payment_for_month := date_trunc('month', NEW.payment_for_month::timestamp)::date;

    IF NEW.category_code IS NULL OR btrim(NEW.category_code) = '' THEN
      NEW.category_code := public.normalize_fee_category_code(coalesce(NEW.description, NEW.title, 'tuition'));
    ELSE
      NEW.category_code := public.normalize_fee_category_code(NEW.category_code);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pop_uploads_payment_period_required_check'
      AND conrelid = 'public.pop_uploads'::regclass
  ) THEN
    ALTER TABLE public.pop_uploads
      ADD CONSTRAINT pop_uploads_payment_period_required_check
      CHECK (
        upload_type <> 'proof_of_payment'
        OR (payment_date IS NOT NULL AND payment_for_month IS NOT NULL)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pop_uploads_payment_month_normalized_check'
      AND conrelid = 'public.pop_uploads'::regclass
  ) THEN
    ALTER TABLE public.pop_uploads
      ADD CONSTRAINT pop_uploads_payment_month_normalized_check
      CHECK (
        upload_type <> 'proof_of_payment'
        OR payment_for_month = date_trunc('month', payment_for_month::timestamp)::date
      );
  END IF;
END
$$;
