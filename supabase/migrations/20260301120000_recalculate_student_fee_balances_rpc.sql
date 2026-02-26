-- Add recompute_balances audit action and RPC for in-app learner balance normalization.

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
          'registration_unpaid',
          'recompute_balances'
        ]
      )
    );
END
$$;

CREATE OR REPLACE FUNCTION public.recalculate_student_fee_balances(
  p_student_id uuid,
  p_actor_id uuid,
  p_reason text DEFAULT 'manual_recompute'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user uuid := auth.uid();
  v_actor_role text;
  v_actor_org uuid;
  v_student_org uuid;
  v_reason text := COALESCE(NULLIF(BTRIM(p_reason), ''), 'manual_recompute');
  v_updated_count integer := 0;
BEGIN
  IF p_student_id IS NULL THEN
    RAISE EXCEPTION 'p_student_id is required';
  END IF;

  IF v_auth_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_actor_id IS NOT NULL AND p_actor_id <> v_auth_user THEN
    RAISE EXCEPTION 'actor mismatch';
  END IF;

  SELECT
    LOWER(COALESCE(p.role, '')),
    COALESCE(p.organization_id, p.preschool_id)
  INTO
    v_actor_role,
    v_actor_org
  FROM public.profiles p
  WHERE p.id = v_auth_user
  LIMIT 1;

  IF v_actor_role NOT IN ('principal', 'principal_admin', 'admin', 'super_admin', 'superadmin') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  SELECT s.preschool_id
  INTO v_student_org
  FROM public.students s
  WHERE s.id = p_student_id
  LIMIT 1;

  IF v_student_org IS NULL THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  IF v_actor_role NOT IN ('super_admin', 'superadmin')
    AND (v_actor_org IS NULL OR v_actor_org <> v_student_org)
  THEN
    RAISE EXCEPTION 'Student is outside your organization';
  END IF;

  WITH existing_rows AS (
    SELECT
      sf.id,
      sf.status AS before_status,
      COALESCE(
        sf.amount_outstanding,
        GREATEST(COALESCE(sf.final_amount, sf.amount, 0) - COALESCE(sf.amount_paid, 0), 0)
      ) AS before_outstanding,
      COALESCE(sf.final_amount, sf.amount, 0) AS before_final_amount,
      COALESCE(sf.amount_paid, 0) AS before_amount_paid,
      sf.due_date
    FROM public.student_fees sf
    WHERE sf.student_id = p_student_id
    FOR UPDATE
  ),
  recomputed AS (
    UPDATE public.student_fees sf
    SET
      amount_outstanding = GREATEST(ROUND((COALESCE(sf.final_amount, sf.amount, 0) - COALESCE(sf.amount_paid, 0))::numeric, 2), 0),
      status = CASE
        WHEN LOWER(COALESCE(sf.status, '')) = 'waived' THEN 'waived'
        WHEN GREATEST(COALESCE(sf.final_amount, sf.amount, 0) - COALESCE(sf.amount_paid, 0), 0) <= 0 THEN 'paid'
        WHEN COALESCE(sf.amount_paid, 0) > 0 THEN 'partially_paid'
        WHEN sf.due_date IS NOT NULL AND sf.due_date < CURRENT_DATE THEN 'overdue'
        ELSE 'pending'
      END,
      updated_at = NOW()
    FROM existing_rows er
    WHERE sf.id = er.id
    RETURNING
      sf.id,
      er.before_status,
      er.before_outstanding,
      sf.status AS after_status,
      sf.amount_outstanding AS after_outstanding,
      er.before_final_amount,
      er.before_amount_paid,
      sf.due_date
  ),
  audit_insert AS (
    INSERT INTO public.fee_corrections_audit (
      organization_id,
      student_id,
      student_fee_id,
      action,
      reason,
      before_snapshot,
      after_snapshot,
      metadata,
      created_by,
      created_by_role,
      source_screen,
      created_at
    )
    SELECT
      v_student_org,
      p_student_id,
      r.id,
      'recompute_balances',
      v_reason,
      jsonb_build_object(
        'status', r.before_status,
        'amount_outstanding', r.before_outstanding,
        'final_amount', r.before_final_amount,
        'amount_paid', r.before_amount_paid
      ),
      jsonb_build_object(
        'status', r.after_status,
        'amount_outstanding', r.after_outstanding,
        'due_date', r.due_date
      ),
      jsonb_build_object(
        'source', 'recalculate_student_fee_balances',
        'actor_id', v_auth_user
      ),
      v_auth_user,
      v_actor_role,
      'principal-student-fees',
      NOW()
    FROM recomputed r
    RETURNING 1
  )
  SELECT COUNT(*)
  INTO v_updated_count
  FROM audit_insert;

  RETURN jsonb_build_object(
    'success', TRUE,
    'student_id', p_student_id,
    'updated_count', v_updated_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_student_fee_balances(uuid, uuid, text) TO authenticated;
