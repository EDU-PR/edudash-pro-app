-- Allow delete actions in fee correction audit trail.
DO $$
BEGIN
  IF to_regclass('public.fee_corrections_audit') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fee_corrections_audit_action_check'
      AND conrelid = 'public.fee_corrections_audit'::regclass
  ) THEN
    ALTER TABLE public.fee_corrections_audit
      DROP CONSTRAINT fee_corrections_audit_action_check;
  END IF;

  ALTER TABLE public.fee_corrections_audit
    ADD CONSTRAINT fee_corrections_audit_action_check
    CHECK (
      action = ANY (
        ARRAY[
          'waive',
          'adjust',
          'delete',
          'mark_paid',
          'mark_unpaid',
          'change_class',
          'tuition_sync',
          'registration_paid',
          'registration_unpaid'
        ]
      )
    );
END
$$;

