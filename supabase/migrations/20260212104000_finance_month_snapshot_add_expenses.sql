-- -----------------------------------------------------------------------------
-- Finance Month Snapshot: add month-scoped expense totals
-- Includes petty cash expenses + financial transaction expenses for selected month.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_finance_month_snapshot(
  p_org_id uuid,
  p_month date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security = off
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_actor_org uuid;
  v_is_super boolean := false;
  v_month date := date_trunc('month', coalesce(p_month, current_date))::date;
  v_due numeric(12,2) := 0;
  v_collected numeric(12,2) := 0;
  v_collected_allocation numeric(12,2) := 0;
  v_outstanding numeric(12,2) := 0;
  v_kpi_delta numeric(12,2) := 0;
  v_collected_source text := 'allocations';
  v_pending_amount numeric(12,2) := 0;
  v_overdue_amount numeric(12,2) := 0;
  v_pending_count int := 0;
  v_overdue_count int := 0;
  v_pending_students int := 0;
  v_overdue_students int := 0;
  v_prepaid numeric(12,2) := 0;
  v_expenses numeric(12,2) := 0;
  v_petty_cash_expenses numeric(12,2) := 0;
  v_financial_expenses numeric(12,2) := 0;
  v_payroll_due numeric(12,2) := 0;
  v_payroll_paid numeric(12,2) := 0;
  v_pending_pop int := 0;
  v_month_locked boolean := false;
  v_categories jsonb := '[]'::jsonb;
  v_as_of_date date := current_date;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT p.role, COALESCE(p.organization_id, p.preschool_id)
  INTO v_actor_role, v_actor_org
  FROM public.profiles p
  WHERE p.id = v_actor OR p.auth_user_id = v_actor
  ORDER BY CASE WHEN p.id = v_actor THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_actor_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  v_is_super := lower(v_actor_role) IN ('super_admin', 'superadmin');
  IF lower(v_actor_role) NOT IN ('admin', 'principal', 'principal_admin', 'super_admin', 'superadmin', 'teacher') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  IF NOT v_is_super AND v_actor_org IS DISTINCT FROM p_org_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cross-organization access denied');
  END IF;

  WITH fee_rows AS (
    SELECT
      sf.id,
      sf.student_id,
      COALESCE(NULLIF(sf.category_code, ''), 'tuition') AS category_code,
      round(greatest(coalesce(sf.final_amount, sf.amount, 0), 0), 2) AS final_amount,
      round(greatest(coalesce(sf.final_amount, sf.amount, 0) - coalesce(sf.amount_paid, 0), 0), 2) AS outstanding_amount,
      lower(coalesce(sf.status, '')) AS status,
      sf.due_date
    FROM public.student_fees sf
    JOIN public.students s ON s.id = sf.student_id
    WHERE COALESCE(s.organization_id, s.preschool_id) = p_org_id
      AND sf.billing_month = v_month
      AND sf.status <> 'waived'
  ),
  allocation_rows AS (
    SELECT
      pa.student_fee_id,
      round(coalesce(sum(pa.allocated_amount), 0), 2) AS collected_amount
    FROM public.payment_allocations pa
    JOIN public.payments p ON p.id = pa.payment_id
    WHERE p.preschool_id = p_org_id
      AND pa.billing_month = v_month
      AND lower(coalesce(p.status, '')) IN ('completed', 'approved', 'paid', 'successful')
    GROUP BY pa.student_fee_id
  ),
  fee_with_flags AS (
    SELECT
      fr.id,
      fr.student_id,
      fr.category_code,
      fr.final_amount,
      fr.outstanding_amount,
      coalesce(ar.collected_amount, 0) AS collected_amount,
      (
        fr.status = 'overdue'
        OR (fr.due_date IS NOT NULL AND fr.due_date::date < v_as_of_date)
      ) AS is_overdue
    FROM fee_rows fr
    LEFT JOIN allocation_rows ar ON ar.student_fee_id = fr.id
  )
  SELECT
    coalesce(sum(fwf.final_amount), 0),
    coalesce(sum(fwf.collected_amount), 0),
    coalesce(sum(fwf.outstanding_amount), 0),
    coalesce(sum(CASE WHEN fwf.outstanding_amount > 0 AND NOT fwf.is_overdue THEN fwf.outstanding_amount ELSE 0 END), 0),
    coalesce(sum(CASE WHEN fwf.outstanding_amount > 0 AND fwf.is_overdue THEN fwf.outstanding_amount ELSE 0 END), 0),
    count(*) FILTER (WHERE fwf.outstanding_amount > 0 AND NOT fwf.is_overdue),
    count(*) FILTER (WHERE fwf.outstanding_amount > 0 AND fwf.is_overdue),
    count(DISTINCT fwf.student_id) FILTER (WHERE fwf.outstanding_amount > 0 AND NOT fwf.is_overdue),
    count(DISTINCT fwf.student_id) FILTER (WHERE fwf.outstanding_amount > 0 AND fwf.is_overdue)
  INTO
    v_due,
    v_collected_allocation,
    v_outstanding,
    v_pending_amount,
    v_overdue_amount,
    v_pending_count,
    v_overdue_count,
    v_pending_students,
    v_overdue_students
  FROM fee_with_flags fwf;

  v_kpi_delta := round(abs((coalesce(v_due, 0) - coalesce(v_outstanding, 0)) - coalesce(v_collected_allocation, 0)), 2);
  IF v_kpi_delta > 0.01 THEN
    v_collected := round(greatest(coalesce(v_due, 0) - coalesce(v_outstanding, 0), 0), 2);
    v_collected_source := 'fee_ledger';
  ELSE
    v_collected := round(coalesce(v_collected_allocation, 0), 2);
  END IF;

  WITH fee_rows AS (
    SELECT
      sf.id,
      COALESCE(NULLIF(sf.category_code, ''), 'tuition') AS category_code,
      round(greatest(coalesce(sf.final_amount, sf.amount, 0), 0), 2) AS final_amount,
      round(greatest(coalesce(sf.final_amount, sf.amount, 0) - coalesce(sf.amount_paid, 0), 0), 2) AS outstanding_amount
    FROM public.student_fees sf
    JOIN public.students s ON s.id = sf.student_id
    WHERE COALESCE(s.organization_id, s.preschool_id) = p_org_id
      AND sf.billing_month = v_month
      AND sf.status <> 'waived'
  ),
  allocation_rows AS (
    SELECT
      pa.student_fee_id,
      round(coalesce(sum(pa.allocated_amount), 0), 2) AS collected_amount
    FROM public.payment_allocations pa
    JOIN public.payments p ON p.id = pa.payment_id
    WHERE p.preschool_id = p_org_id
      AND pa.billing_month = v_month
      AND lower(coalesce(p.status, '')) IN ('completed', 'approved', 'paid', 'successful')
    GROUP BY pa.student_fee_id
  )
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'category_code', t.category_code,
        'due', round(t.due, 2),
        'collected', round(t.collected, 2),
        'outstanding', round(t.outstanding, 2)
      )
      ORDER BY t.category_code
    ),
    '[]'::jsonb
  )
  INTO v_categories
  FROM (
    SELECT
      fr.category_code,
      coalesce(sum(fr.final_amount), 0) AS due,
      coalesce(sum(ar.collected_amount), 0) AS collected,
      coalesce(sum(fr.outstanding_amount), 0) AS outstanding
    FROM fee_rows fr
    LEFT JOIN allocation_rows ar ON ar.student_fee_id = fr.id
    GROUP BY fr.category_code
  ) t;

  SELECT coalesce(sum(pa.allocated_amount), 0)
  INTO v_prepaid
  FROM public.payment_allocations pa
  JOIN public.payments p ON p.id = pa.payment_id
  WHERE p.preschool_id = p_org_id
    AND pa.billing_month > v_month
    AND date_trunc('month', coalesce(p.transaction_date, p.created_at)::timestamp)::date <= v_month
    AND lower(coalesce(p.status, '')) IN ('completed', 'approved', 'paid', 'successful');

  BEGIN
    SELECT coalesce(sum(abs(pct.amount)), 0)
    INTO v_petty_cash_expenses
    FROM public.petty_cash_transactions pct
    WHERE pct.school_id = p_org_id
      AND lower(coalesce(pct.type, '')) = 'expense'
      AND lower(coalesce(pct.status, '')) IN ('approved', 'completed')
      AND date_trunc('month', coalesce(pct.transaction_date::timestamp, pct.created_at))::date = v_month;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    v_petty_cash_expenses := 0;
  END;

  BEGIN
    SELECT coalesce(sum(abs(ft.amount)), 0)
    INTO v_financial_expenses
    FROM public.financial_transactions ft
    WHERE ft.preschool_id = p_org_id
      AND lower(coalesce(ft.type, '')) IN ('expense', 'operational_expense', 'salary', 'purchase')
      AND lower(coalesce(ft.status, '')) IN ('approved', 'completed')
      AND date_trunc('month', ft.created_at::timestamp)::date = v_month;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    v_financial_expenses := 0;
  END;

  v_expenses := round(coalesce(v_petty_cash_expenses, 0) + coalesce(v_financial_expenses, 0), 2);

  SELECT coalesce(sum(pp.amount), 0)
  INTO v_payroll_paid
  FROM public.payroll_payments pp
  WHERE pp.organization_id = p_org_id
    AND date_trunc('month', pp.payment_month::timestamp)::date = v_month;

  SELECT coalesce(sum(prf.net_salary), 0)
  INTO v_payroll_due
  FROM public.payroll_recipients pr
  LEFT JOIN LATERAL (
    SELECT pp.base_salary, pp.allowances, pp.deductions, pp.net_salary
    FROM public.payroll_profiles pp
    WHERE pp.payroll_recipient_id = pr.id
      AND pp.effective_from <= v_month
    ORDER BY pp.effective_from DESC, pp.created_at DESC
    LIMIT 1
  ) prf ON true
  WHERE pr.organization_id = p_org_id
    AND pr.active = true;

  SELECT count(*)::int
  INTO v_pending_pop
  FROM public.pop_uploads pu
  WHERE pu.preschool_id = p_org_id
    AND pu.upload_type = 'proof_of_payment'
    AND pu.status = 'pending';

  SELECT exists(
    SELECT 1
    FROM public.finance_month_closures fmc
    WHERE fmc.organization_id = p_org_id
      AND fmc.month = v_month
      AND fmc.is_locked = true
  )
  INTO v_month_locked;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', p_org_id,
    'month', v_month,
    'month_locked', v_month_locked,
    'due_this_month', round(coalesce(v_due, 0), 2),
    'collected_this_month', round(coalesce(v_collected, 0), 2),
    'collected_allocated_amount', round(coalesce(v_collected_allocation, 0), 2),
    'collected_source', v_collected_source,
    'kpi_delta', round(coalesce(v_kpi_delta, 0), 2),
    'still_outstanding', round(coalesce(v_outstanding, 0), 2),
    'pending_amount', round(coalesce(v_pending_amount, 0), 2),
    'overdue_amount', round(coalesce(v_overdue_amount, 0), 2),
    'pending_count', coalesce(v_pending_count, 0),
    'overdue_count', coalesce(v_overdue_count, 0),
    'pending_students', coalesce(v_pending_students, 0),
    'overdue_students', coalesce(v_overdue_students, 0),
    'prepaid_for_future_months', round(coalesce(v_prepaid, 0), 2),
    'expenses_this_month', round(coalesce(v_expenses, 0), 2),
    'petty_cash_expenses_this_month', round(coalesce(v_petty_cash_expenses, 0), 2),
    'financial_expenses_this_month', round(coalesce(v_financial_expenses, 0), 2),
    'net_after_expenses', round(coalesce(v_collected, 0) - coalesce(v_expenses, 0), 2),
    'payroll_due', round(coalesce(v_payroll_due, 0), 2),
    'payroll_paid', round(coalesce(v_payroll_paid, 0), 2),
    'pending_pop_reviews', v_pending_pop,
    'categories', v_categories,
    'as_of_date', v_as_of_date,
    'generated_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_finance_month_snapshot(uuid, date) TO authenticated;
