-- Fix get_payroll_roster upserts to match partial unique indexes.
-- Without matching WHERE predicates on ON CONFLICT targets, Postgres raises:
--   42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification

BEGIN;

-- Ensure expected partial unique indexes exist.
CREATE UNIQUE INDEX IF NOT EXISTS ux_payroll_recipients_teacher
  ON public.payroll_recipients(organization_id, teacher_id)
  WHERE teacher_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_payroll_recipients_principal_profile
  ON public.payroll_recipients(organization_id, role_type, profile_id)
  WHERE role_type = 'principal' AND profile_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_payroll_roster(
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
  v_items jsonb := '[]'::jsonb;
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

  -- Ensure teacher recipients exist.
  INSERT INTO public.payroll_recipients (organization_id, role_type, teacher_id, profile_id, display_name, active, metadata)
  SELECT
    p_org_id,
    'teacher',
    t.id,
    coalesce(t.user_id, t.auth_user_id),
    coalesce(nullif(trim(coalesce(t.full_name, '')), ''), trim(coalesce(t.first_name, '') || ' ' || coalesce(t.last_name, '')), t.email, 'Teacher'),
    coalesce(t.is_active, true),
    jsonb_build_object('source', 'teachers')
  FROM public.teachers t
  WHERE t.preschool_id = p_org_id
    AND t.id IS NOT NULL
  ON CONFLICT (organization_id, teacher_id) WHERE teacher_id IS NOT NULL
  DO UPDATE SET
    profile_id = coalesce(excluded.profile_id, payroll_recipients.profile_id),
    display_name = excluded.display_name,
    active = excluded.active,
    updated_at = now();

  -- Ensure principal recipient exists.
  INSERT INTO public.payroll_recipients (organization_id, role_type, teacher_id, profile_id, display_name, active, metadata)
  SELECT
    p_org_id,
    'principal',
    NULL,
    pr.id,
    coalesce(nullif(trim(coalesce(pr.full_name, '')), ''), trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), pr.email, 'Principal'),
    true,
    jsonb_build_object('source', 'profiles')
  FROM public.profiles pr
  WHERE COALESCE(pr.organization_id, pr.preschool_id) = p_org_id
    AND lower(pr.role) IN ('principal', 'principal_admin')
  ORDER BY CASE WHEN lower(pr.role) = 'principal' THEN 0 ELSE 1 END
  LIMIT 1
  ON CONFLICT (organization_id, role_type, profile_id) WHERE role_type = 'principal' AND profile_id IS NOT NULL
  DO UPDATE SET
    display_name = excluded.display_name,
    active = true,
    updated_at = now();

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'payroll_recipient_id', pr.id,
        'role_type', pr.role_type,
        'display_name', pr.display_name,
        'teacher_id', pr.teacher_id,
        'profile_id', pr.profile_id,
        'active', pr.active,
        'base_salary', coalesce(pprof.base_salary, 0),
        'allowances', coalesce(pprof.allowances, 0),
        'deductions', coalesce(pprof.deductions, 0),
        'net_salary', coalesce(pprof.net_salary, 0),
        'salary_effective_from', pprof.effective_from,
        'paid_this_month', coalesce(pm.paid_this_month, false),
        'paid_amount_this_month', coalesce(pm.paid_amount, 0),
        'last_paid_at', pm.last_paid_at
      )
      ORDER BY CASE WHEN pr.role_type = 'principal' THEN 0 ELSE 1 END, lower(pr.display_name)
    ),
    '[]'::jsonb
  )
  INTO v_items
  FROM public.payroll_recipients pr
  LEFT JOIN LATERAL (
    SELECT pp.base_salary, pp.allowances, pp.deductions, pp.net_salary, pp.effective_from
    FROM public.payroll_profiles pp
    WHERE pp.payroll_recipient_id = pr.id
      AND pp.effective_from <= v_month
    ORDER BY pp.effective_from DESC, pp.created_at DESC
    LIMIT 1
  ) pprof ON true
  LEFT JOIN LATERAL (
    SELECT
      true AS paid_this_month,
      sum(p.amount)::numeric AS paid_amount,
      max(p.created_at) AS last_paid_at
    FROM public.payroll_payments p
    WHERE p.payroll_recipient_id = pr.id
      AND date_trunc('month', p.payment_month::timestamp)::date = v_month
  ) pm ON true
  WHERE pr.organization_id = p_org_id
    AND pr.active = true;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', p_org_id,
    'month', v_month,
    'items', v_items,
    'generated_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_payroll_roster(uuid, date) TO authenticated;

COMMIT;
