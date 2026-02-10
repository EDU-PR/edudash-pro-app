-- -----------------------------------------------------------------------------
-- Finance integrity hardening (P0/P1)
-- - Canonical active-student scoping for month snapshot KPIs.
-- - Reconciliation counters for excluded inactive students.
-- - Informational registration revenue + payroll split fields.
-- - POP approval guard for inactive students.
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
  v_operational_financial_expenses numeric(12,2) := 0;
  v_payroll_expenses_this_month numeric(12,2) := 0;
  v_operational_expenses_this_month numeric(12,2) := 0;
  v_registration_revenue numeric(12,2) := 0;
  v_excluded_inactive_due numeric(12,2) := 0;
  v_excluded_inactive_outstanding numeric(12,2) := 0;
  v_excluded_inactive_students int := 0;
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

  -- Canonical operational scope: only students that are active by flag and status.
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
      AND lower(coalesce(sf.status, '')) <> 'waived'
      AND s.is_active = true
      AND lower(coalesce(s.status, '')) = 'active'
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

  WITH inactive_fee_rows AS (
    SELECT
      sf.student_id,
      round(greatest(coalesce(sf.final_amount, sf.amount, 0), 0), 2) AS final_amount,
      round(greatest(coalesce(sf.final_amount, sf.amount, 0) - coalesce(sf.amount_paid, 0), 0), 2) AS outstanding_amount
    FROM public.student_fees sf
    JOIN public.students s ON s.id = sf.student_id
    WHERE COALESCE(s.organization_id, s.preschool_id) = p_org_id
      AND sf.billing_month = v_month
      AND lower(coalesce(sf.status, '')) <> 'waived'
      AND (
        s.is_active IS DISTINCT FROM true
        OR lower(coalesce(s.status, '')) <> 'active'
      )
  )
  SELECT
    coalesce(sum(ifr.final_amount), 0),
    coalesce(sum(ifr.outstanding_amount), 0),
    count(DISTINCT ifr.student_id)::int
  INTO
    v_excluded_inactive_due,
    v_excluded_inactive_outstanding,
    v_excluded_inactive_students
  FROM inactive_fee_rows ifr;

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
      AND lower(coalesce(sf.status, '')) <> 'waived'
      AND s.is_active = true
      AND lower(coalesce(s.status, '')) = 'active'
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
  JOIN public.student_fees sf ON sf.id = pa.student_fee_id
  JOIN public.students s ON s.id = sf.student_id
  WHERE p.preschool_id = p_org_id
    AND COALESCE(s.organization_id, s.preschool_id) = p_org_id
    AND s.is_active = true
    AND lower(coalesce(s.status, '')) = 'active'
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
    SELECT
      coalesce(sum(CASE WHEN lower(coalesce(ft.type, '')) = 'salary' THEN abs(ft.amount) ELSE 0 END), 0),
      coalesce(sum(CASE WHEN lower(coalesce(ft.type, '')) IN ('expense', 'operational_expense', 'purchase') THEN abs(ft.amount) ELSE 0 END), 0)
    INTO
      v_payroll_expenses_this_month,
      v_operational_financial_expenses
    FROM public.financial_transactions ft
    WHERE ft.preschool_id = p_org_id
      AND lower(coalesce(ft.type, '')) IN ('expense', 'operational_expense', 'salary', 'purchase')
      AND lower(coalesce(ft.status, '')) IN ('approved', 'completed')
      AND date_trunc('month', ft.created_at::timestamp)::date = v_month;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    v_payroll_expenses_this_month := 0;
    v_operational_financial_expenses := 0;
  END;

  v_financial_expenses := round(
    coalesce(v_payroll_expenses_this_month, 0) + coalesce(v_operational_financial_expenses, 0),
    2
  );
  v_operational_expenses_this_month := round(
    coalesce(v_petty_cash_expenses, 0) + coalesce(v_operational_financial_expenses, 0),
    2
  );
  v_expenses := round(
    coalesce(v_operational_expenses_this_month, 0) + coalesce(v_payroll_expenses_this_month, 0),
    2
  );

  BEGIN
    SELECT coalesce(sum(source_rows.amount), 0)
    INTO v_registration_revenue
    FROM (
      SELECT coalesce(cr.registration_fee_amount::numeric, 0) AS amount
      FROM public.child_registration_requests cr
      WHERE cr.preschool_id = p_org_id
        AND cr.payment_verified = true
        AND lower(coalesce(cr.status, '')) = 'approved'
        AND date_trunc('month', coalesce(cr.reviewed_at::timestamp, cr.created_at::timestamp))::date = v_month

      UNION ALL

      SELECT coalesce(rr.registration_fee_amount::numeric, 0) AS amount
      FROM public.registration_requests rr
      WHERE rr.organization_id = p_org_id
        AND rr.payment_verified = true
        AND lower(coalesce(rr.status, '')) = 'approved'
        AND date_trunc(
          'month',
          coalesce(rr.payment_date::timestamp, rr.reviewed_date::timestamp, rr.created_at::timestamp)
        )::date = v_month
    ) source_rows;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    v_registration_revenue := 0;
  END;

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
    'payroll_expenses_this_month', round(coalesce(v_payroll_expenses_this_month, 0), 2),
    'operational_expenses_this_month', round(coalesce(v_operational_expenses_this_month, 0), 2),
    'registration_revenue', round(coalesce(v_registration_revenue, 0), 2),
    'excluded_inactive_due', round(coalesce(v_excluded_inactive_due, 0), 2),
    'excluded_inactive_outstanding', round(coalesce(v_excluded_inactive_outstanding, 0), 2),
    'excluded_inactive_students', coalesce(v_excluded_inactive_students, 0),
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

CREATE OR REPLACE FUNCTION public.approve_pop_payment(
  p_upload_id uuid,
  p_billing_month date,
  p_category_code text,
  p_allocations jsonb DEFAULT '[]'::jsonb,
  p_notes text DEFAULT NULL
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
  v_upload public.pop_uploads%ROWTYPE;
  v_student_is_active boolean := false;
  v_student_status text := '';
  v_student_org uuid;
  v_payment_id uuid;
  v_payment_reference text;
  v_payment_amount numeric(12,2);
  v_billing_month date;
  v_category_code text;
  v_total_alloc numeric(12,2) := 0;
  v_overpayment numeric(12,2) := 0;
  v_fee record;
  v_fee_id uuid;
  v_alloc_item jsonb;
  v_requested_alloc numeric(12,2);
  v_effective_alloc numeric(12,2);
  v_fee_amount numeric(12,2);
  v_due_amount numeric(12,2);
  v_fee_structure_id uuid;
  v_fee_type_hint text;
  v_fee_name_hint text;
  v_fee_desc_hint text;
  v_fee_id_list text[] := ARRAY[]::text[];
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
  IF lower(v_actor_role) NOT IN ('admin', 'principal', 'principal_admin', 'super_admin', 'superadmin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  SELECT *
  INTO v_upload
  FROM public.pop_uploads
  WHERE id = p_upload_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'POP upload not found');
  END IF;

  IF v_upload.upload_type <> 'proof_of_payment' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Upload is not a proof of payment');
  END IF;

  IF v_upload.student_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'POP upload is missing student linkage');
  END IF;

  SELECT
    s.is_active,
    lower(coalesce(s.status, '')),
    COALESCE(s.organization_id, s.preschool_id)
  INTO
    v_student_is_active,
    v_student_status,
    v_student_org
  FROM public.students s
  WHERE s.id = v_upload.student_id
  LIMIT 1;

  IF NOT FOUND
    OR v_student_org IS DISTINCT FROM v_upload.preschool_id
    OR v_student_is_active IS DISTINCT FROM true
    OR v_student_status <> 'active'
  THEN
    RETURN jsonb_build_object('success', false, 'error', 'Student is no longer active in this school');
  END IF;

  IF NOT v_is_super AND v_actor_org IS DISTINCT FROM v_upload.preschool_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cross-organization access denied');
  END IF;

  v_payment_amount := round(coalesce(v_upload.payment_amount, 0)::numeric, 2);
  IF v_payment_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment amount must be greater than zero');
  END IF;

  v_billing_month := date_trunc(
    'month',
    coalesce(
      p_billing_month::timestamp,
      v_upload.payment_for_month::timestamp,
      v_upload.payment_date::timestamp,
      now()
    )
  )::date;

  v_category_code := public.normalize_fee_category_code(
    coalesce(p_category_code, v_upload.category_code, v_upload.description, v_upload.title, 'tuition')
  );

  IF v_upload.status = 'approved' THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'upload_id', v_upload.id,
      'message', 'POP already approved'
    );
  END IF;

  v_payment_reference := coalesce(
    nullif(v_upload.payment_reference, ''),
    format('POP-%s', upper(replace(v_upload.id::text, '-', '')))
  );

  INSERT INTO public.payments (
    student_id,
    parent_id,
    preschool_id,
    amount,
    amount_cents,
    currency,
    payment_method,
    payment_reference,
    status,
    description,
    attachment_url,
    reviewed_by,
    reviewed_at,
    submitted_at,
    billing_month,
    category_code,
    transaction_date,
    metadata
  )
  VALUES (
    v_upload.student_id,
    v_upload.uploaded_by,
    v_upload.preschool_id,
    v_payment_amount,
    round(v_payment_amount * 100),
    'ZAR',
    public.normalize_finance_payment_method(coalesce(v_upload.payment_method, 'bank_transfer')),
    v_payment_reference,
    'completed',
    coalesce(nullif(v_upload.description, ''), nullif(v_upload.title, ''), 'School payment'),
    v_upload.file_path,
    v_actor,
    now(),
    coalesce(v_upload.created_at, now()),
    v_billing_month,
    v_category_code,
    coalesce(v_upload.payment_date, current_date),
    jsonb_build_object(
      'pop_upload_id', v_upload.id,
      'category_code', v_category_code,
      'billing_month', v_billing_month::text,
      'payment_for_month', v_billing_month::text,
      'transaction_date', coalesce(v_upload.payment_date, current_date)::text
    )
  )
  RETURNING id INTO v_payment_id;

  IF jsonb_typeof(coalesce(p_allocations, '[]'::jsonb)) = 'array' AND jsonb_array_length(coalesce(p_allocations, '[]'::jsonb)) > 0 THEN
    FOR v_alloc_item IN
      SELECT value FROM jsonb_array_elements(coalesce(p_allocations, '[]'::jsonb))
    LOOP
      v_fee_id := nullif(v_alloc_item->>'student_fee_id', '')::uuid;
      v_requested_alloc := round(coalesce((v_alloc_item->>'amount')::numeric, 0), 2);

      IF v_fee_id IS NULL OR v_requested_alloc <= 0 THEN
        CONTINUE;
      END IF;

      SELECT sf.id,
             sf.student_id,
             sf.final_amount,
             sf.amount,
             sf.amount_paid,
             sf.amount_outstanding,
             sf.status,
             sf.billing_month,
             sf.category_code
      INTO v_fee
      FROM public.student_fees sf
      WHERE sf.id = v_fee_id
        AND sf.student_id = v_upload.student_id
      FOR UPDATE;

      IF NOT FOUND THEN
        CONTINUE;
      END IF;

      v_fee_amount := round(coalesce(v_fee.final_amount, v_fee.amount, 0), 2);
      v_due_amount := round(greatest(coalesce(v_fee.amount_outstanding, v_fee_amount - coalesce(v_fee.amount_paid, 0), v_fee_amount), 0), 2);

      v_effective_alloc := round(
        least(
          v_requested_alloc,
          greatest(v_payment_amount - v_total_alloc, 0),
          CASE WHEN v_due_amount > 0 THEN v_due_amount ELSE v_requested_alloc END
        ),
        2
      );

      IF v_effective_alloc <= 0 THEN
        CONTINUE;
      END IF;

      INSERT INTO public.payment_allocations (
        payment_id,
        student_fee_id,
        allocated_amount,
        billing_month,
        category_code,
        notes,
        created_by,
        updated_at
      )
      VALUES (
        v_payment_id,
        v_fee.id,
        v_effective_alloc,
        coalesce(v_fee.billing_month, v_billing_month),
        public.normalize_fee_category_code(coalesce(v_fee.category_code, v_category_code)),
        nullif(v_alloc_item->>'notes', ''),
        v_actor,
        now()
      )
      ON CONFLICT (payment_id, student_fee_id)
      DO UPDATE SET
        allocated_amount = EXCLUDED.allocated_amount,
        billing_month = EXCLUDED.billing_month,
        category_code = EXCLUDED.category_code,
        notes = EXCLUDED.notes,
        updated_at = now();

      v_total_alloc := round(v_total_alloc + v_effective_alloc, 2);
    END LOOP;
  END IF;

  IF v_total_alloc <= 0 THEN
    SELECT sf.id,
           sf.student_id,
           sf.fee_structure_id,
           sf.final_amount,
           sf.amount,
           sf.amount_paid,
           sf.amount_outstanding,
           sf.status,
           sf.billing_month,
           sf.category_code
    INTO v_fee
    FROM public.student_fees sf
    WHERE sf.student_id = v_upload.student_id
      AND sf.billing_month = v_billing_month
      AND public.normalize_fee_category_code(sf.category_code) = v_category_code
    ORDER BY sf.created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      SELECT fs.id,
             fs.amount,
             fs.fee_type,
             fs.name,
             fs.description
      INTO v_fee_structure_id,
           v_fee_amount,
           v_fee_type_hint,
           v_fee_name_hint,
           v_fee_desc_hint
      FROM public.fee_structures fs
      WHERE fs.preschool_id = v_upload.preschool_id
        AND fs.is_active = true
        AND (
          (v_category_code = 'tuition' AND (
            lower(coalesce(fs.fee_type, '')) IN ('tuition', 'school_fees', 'school_fee', 'monthly')
            OR lower(coalesce(fs.name, '') || ' ' || coalesce(fs.description, '')) ~ '(tuition|school\s*fee|monthly)'
          ))
          OR (v_category_code = 'uniform' AND lower(coalesce(fs.fee_type, '')) LIKE 'uniform%')
          OR lower(coalesce(fs.fee_type, '')) = v_category_code
        )
      ORDER BY fs.effective_from DESC NULLS LAST, fs.created_at DESC NULLS LAST
      LIMIT 1;

      IF v_fee_structure_id IS NULL THEN
        SELECT fs.id,
               fs.amount,
               fs.fee_type,
               fs.name,
               fs.description
        INTO v_fee_structure_id,
             v_fee_amount,
             v_fee_type_hint,
             v_fee_name_hint,
             v_fee_desc_hint
        FROM public.fee_structures fs
        WHERE fs.preschool_id = v_upload.preschool_id
          AND fs.is_active = true
        ORDER BY fs.effective_from DESC NULLS LAST, fs.created_at DESC NULLS LAST
        LIMIT 1;
      END IF;

      IF v_fee_structure_id IS NULL THEN
        UPDATE public.pop_uploads
        SET status = 'needs_revision',
            reviewed_by = v_actor,
            reviewed_at = now(),
            review_notes = coalesce(nullif(p_notes, ''), 'No active fee structure found for this payment category')
        WHERE id = p_upload_id;

        DELETE FROM public.payments WHERE id = v_payment_id;

        RETURN jsonb_build_object('success', false, 'error', 'No active fee structure available for allocation');
      END IF;

      v_fee_amount := round(coalesce(v_fee_amount, v_payment_amount), 2);

      INSERT INTO public.student_fees (
        student_id,
        fee_structure_id,
        amount,
        final_amount,
        due_date,
        billing_month,
        category_code,
        status,
        amount_paid,
        amount_outstanding,
        created_at,
        updated_at
      )
      VALUES (
        v_upload.student_id,
        v_fee_structure_id,
        v_fee_amount,
        v_fee_amount,
        v_billing_month,
        v_billing_month,
        v_category_code,
        'pending',
        0,
        v_fee_amount,
        now(),
        now()
      )
      RETURNING id,
                student_id,
                fee_structure_id,
                final_amount,
                amount,
                amount_paid,
                amount_outstanding,
                status,
                billing_month,
                category_code
      INTO v_fee;
    END IF;

    v_fee_amount := round(coalesce(v_fee.final_amount, v_fee.amount, 0), 2);
    v_due_amount := round(greatest(coalesce(v_fee.amount_outstanding, v_fee_amount - coalesce(v_fee.amount_paid, 0), v_fee_amount), 0), 2);

    v_effective_alloc := round(
      least(
        greatest(v_payment_amount - v_total_alloc, 0),
        CASE WHEN v_due_amount > 0 THEN v_due_amount ELSE greatest(v_payment_amount - v_total_alloc, 0) END
      ),
      2
    );

    IF v_effective_alloc > 0 THEN
      INSERT INTO public.payment_allocations (
        payment_id,
        student_fee_id,
        allocated_amount,
        billing_month,
        category_code,
        notes,
        created_by,
        updated_at
      )
      VALUES (
        v_payment_id,
        v_fee.id,
        v_effective_alloc,
        coalesce(v_fee.billing_month, v_billing_month),
        public.normalize_fee_category_code(coalesce(v_fee.category_code, v_category_code)),
        'Auto allocation',
        v_actor,
        now()
      )
      ON CONFLICT (payment_id, student_fee_id)
      DO UPDATE SET
        allocated_amount = EXCLUDED.allocated_amount,
        billing_month = EXCLUDED.billing_month,
        category_code = EXCLUDED.category_code,
        notes = EXCLUDED.notes,
        updated_at = now();

      v_total_alloc := round(v_total_alloc + v_effective_alloc, 2);
    END IF;
  END IF;

  FOR v_fee IN
    SELECT sf.id,
           sf.final_amount,
           sf.amount,
           sf.status,
           sf.amount_paid,
           sf.amount_outstanding,
           coalesce(sum(pa.allocated_amount), 0)::numeric AS total_allocated
    FROM public.student_fees sf
    JOIN public.payment_allocations pa
      ON pa.student_fee_id = sf.id
    WHERE pa.payment_id = v_payment_id
    GROUP BY sf.id, sf.final_amount, sf.amount, sf.status, sf.amount_paid, sf.amount_outstanding
  LOOP
    v_fee_amount := round(coalesce(v_fee.final_amount, v_fee.amount, 0), 2);

    UPDATE public.student_fees sf
    SET amount_paid = least(v_fee.total_allocated, v_fee_amount),
        amount_outstanding = greatest(v_fee_amount - least(v_fee.total_allocated, v_fee_amount), 0),
        status = CASE
          WHEN greatest(v_fee_amount - least(v_fee.total_allocated, v_fee_amount), 0) = 0 THEN 'paid'
          WHEN least(v_fee.total_allocated, v_fee_amount) > 0 THEN 'partially_paid'
          ELSE sf.status
        END,
        paid_date = CASE
          WHEN greatest(v_fee_amount - least(v_fee.total_allocated, v_fee_amount), 0) = 0
            THEN coalesce(sf.paid_date, current_date)
          ELSE sf.paid_date
        END,
        updated_at = now()
    WHERE sf.id = v_fee.id;

    v_fee_id_list := array_append(v_fee_id_list, v_fee.id::text);
  END LOOP;

  v_overpayment := round(greatest(v_payment_amount - v_total_alloc, 0), 2);

  IF v_overpayment > 0 THEN
    INSERT INTO public.family_credits (
      parent_id,
      student_id,
      preschool_id,
      category_code,
      amount,
      remaining_amount,
      origin_payment_id,
      status,
      metadata,
      created_at,
      updated_at
    )
    VALUES (
      v_upload.uploaded_by,
      v_upload.student_id,
      v_upload.preschool_id,
      v_category_code,
      v_overpayment,
      v_overpayment,
      v_payment_id,
      'available',
      jsonb_build_object(
        'source', 'approve_pop_payment',
        'pop_upload_id', v_upload.id,
        'billing_month', v_billing_month::text,
        'auto_apply_target_month', (v_billing_month + INTERVAL '1 month')::date::text
      ),
      now(),
      now()
    );
  END IF;

  UPDATE public.pop_uploads
  SET status = 'approved',
      reviewed_by = v_actor,
      reviewed_at = now(),
      review_notes = coalesce(nullif(p_notes, ''), review_notes, 'Payment verified and approved'),
      payment_for_month = v_billing_month,
      category_code = v_category_code,
      updated_at = now()
  WHERE id = p_upload_id;

  UPDATE public.payments
  SET fee_ids = CASE WHEN coalesce(array_length(v_fee_id_list, 1), 0) > 0 THEN v_fee_id_list ELSE fee_ids END,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'allocation_total', v_total_alloc,
        'overpayment_amount', v_overpayment,
        'category_code', v_category_code,
        'billing_month', v_billing_month::text,
        'approved_by_rpc', true
      ),
      updated_at = now()
  WHERE id = v_payment_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'upload_id', p_upload_id,
    'billing_month', v_billing_month,
    'category_code', v_category_code,
    'allocated_amount', v_total_alloc,
    'overpayment_amount', v_overpayment,
    'fee_ids', coalesce(v_fee_id_list, ARRAY[]::text[])
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_pop_payment(uuid, date, text, jsonb, text) TO authenticated;
