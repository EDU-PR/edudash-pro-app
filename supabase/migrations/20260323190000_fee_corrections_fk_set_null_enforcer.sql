-- Ensure fee_corrections_audit keeps history when student_fees rows are deleted.
-- Some environments may still carry legacy CASCADE FK constraints on student_fee_id.

DO $$
DECLARE
  constraint_row record;
BEGIN
  IF to_regclass('public.fee_corrections_audit') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.fee_corrections_audit
    ALTER COLUMN student_fee_id DROP NOT NULL;

  -- Drop every FK on fee_corrections_audit.student_fee_id regardless of prior name.
  FOR constraint_row IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'public.fee_corrections_audit'::regclass
      AND c.contype = 'f'
      AND a.attname = 'student_fee_id'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.fee_corrections_audit DROP CONSTRAINT %I',
      constraint_row.conname
    );
  END LOOP;

  ALTER TABLE public.fee_corrections_audit
    ADD CONSTRAINT fee_corrections_audit_student_fee_id_fkey
    FOREIGN KEY (student_fee_id)
    REFERENCES public.student_fees(id)
    ON DELETE SET NULL;
END
$$;
