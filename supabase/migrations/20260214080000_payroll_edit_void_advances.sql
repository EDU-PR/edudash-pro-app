-- Migration: payroll_edit_void_advances
-- Purpose: Add payroll payment editing, voiding, salary advances, and payment history support
-- Date: 2026-02-14

-- -----------------------------------------------------------------------------
-- 1. Add status + voided metadata to payroll_payments
-- -----------------------------------------------------------------------------

ALTER TABLE public.payroll_payments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed';

ALTER TABLE public.payroll_payments
  ADD COLUMN IF NOT EXISTS voided_at timestamptz;

ALTER TABLE public.payroll_payments
  ADD COLUMN IF NOT EXISTS voided_by uuid;

ALTER TABLE public.payroll_payments
  ADD COLUMN IF NOT EXISTS void_reason text;

ALTER TABLE public.payroll_payments
  ADD COLUMN IF NOT EXISTS original_amount numeric(12,2);

ALTER TABLE public.payroll_payments
  ADD COLUMN IF NOT EXISTS edit_reason text;

ALTER TABLE public.payroll_payments
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

ALTER TABLE public.payroll_payments
  ADD COLUMN IF NOT EXISTS edited_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payroll_payments_status_check'
      AND conrelid = 'public.payroll_payments'::regclass
  ) THEN
    ALTER TABLE public.payroll_payments
      ADD CONSTRAINT payroll_payments_status_check
      CHECK (status IN ('completed', 'voided', 'edited'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_payroll_payments_status
  ON public.payroll_payments(status);

-- -----------------------------------------------------------------------------
-- 2. Create payroll_advances table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payroll_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_recipient_id uuid NOT NULL REFERENCES public.payroll_recipients(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  advance_date date NOT NULL DEFAULT current_date,
  reason text,
  repayment_month date,
  repaid boolean NOT NULL DEFAULT false,
  repaid_at timestamptz,
  repaid_amount numeric(12,2) DEFAULT 0,
  recorded_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_advances_recipient
  ON public.payroll_advances(payroll_recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payroll_advances_org
  ON public.payroll_advances(organization_id, advance_date DESC);

ALTER TABLE public.payroll_advances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_advances_org_access ON public.payroll_advances;
CREATE POLICY payroll_advances_org_access
ON public.payroll_advances
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
      AND (
        lower(p.role) IN ('super_admin', 'superadmin')
        OR (
          COALESCE(p.organization_id, p.preschool_id) = payroll_advances.organization_id
          AND lower(p.role) IN ('admin', 'principal', 'principal_admin')
        )
      )
  )
);

-- -----------------------------------------------------------------------------
-- 3. RPC: edit_payroll_payment — update amount with audit trail
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.edit_payroll_payment(
  p_payment_id uuid,
  p_new_amount numeric,
  p_reason text DEFAULT NULL
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
  v_payment public.payroll_payments%ROWTYPE;
  v_month_locked boolean := false;
  v_original_amount numeric;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF coalesce(p_new_amount, 0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'New amount must be greater than zero');
  END IF;

  IF coalesce(trim(p_reason), '') = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'A reason is required when editing a payment');
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
  INTO v_payment
  FROM public.payroll_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
  END IF;

  IF v_payment.status = 'voided' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot edit a voided payment');
  END IF;

  IF NOT v_is_super AND v_actor_org IS DISTINCT FROM v_payment.organization_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cross-organization access denied');
  END IF;

  SELECT exists(
    SELECT 1
    FROM public.finance_month_closures fmc
    WHERE fmc.organization_id = v_payment.organization_id
      AND fmc.month = v_payment.payment_month
      AND fmc.is_locked = true
  )
  INTO v_month_locked;

  IF v_month_locked AND NOT v_is_super THEN
    RETURN jsonb_build_object('success', false, 'error', 'Selected month is locked');
  END IF;

  -- Store original amount if not already stored (first edit)
  v_original_amount := COALESCE(v_payment.original_amount, v_payment.amount);

  UPDATE public.payroll_payments
  SET
    amount = round(p_new_amount, 2),
    original_amount = v_original_amount,
    status = 'edited',
    edit_reason = p_reason,
    edited_at = now(),
    edited_by = v_actor,
    updated_at = now()
  WHERE id = p_payment_id;

  -- Also update the corresponding financial_transaction
  IF v_payment.financial_tx_id IS NOT NULL THEN
    UPDATE public.financial_transactions
    SET
      amount = round(p_new_amount, 2),
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'edited', true,
        'original_amount', v_original_amount,
        'edit_reason', p_reason,
        'edited_at', now()::text
      ),
      updated_at = now()
    WHERE id = v_payment.financial_tx_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'original_amount', v_original_amount,
    'new_amount', round(p_new_amount, 2)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.edit_payroll_payment(uuid, numeric, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. RPC: void_payroll_payment — mark payment as voided
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.void_payroll_payment(
  p_payment_id uuid,
  p_reason text DEFAULT NULL
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
  v_payment public.payroll_payments%ROWTYPE;
  v_month_locked boolean := false;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF coalesce(trim(p_reason), '') = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'A reason is required when voiding a payment');
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
  INTO v_payment
  FROM public.payroll_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
  END IF;

  IF v_payment.status = 'voided' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment is already voided');
  END IF;

  IF NOT v_is_super AND v_actor_org IS DISTINCT FROM v_payment.organization_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cross-organization access denied');
  END IF;

  SELECT exists(
    SELECT 1
    FROM public.finance_month_closures fmc
    WHERE fmc.organization_id = v_payment.organization_id
      AND fmc.month = v_payment.payment_month
      AND fmc.is_locked = true
  )
  INTO v_month_locked;

  IF v_month_locked AND NOT v_is_super THEN
    RETURN jsonb_build_object('success', false, 'error', 'Selected month is locked');
  END IF;

  UPDATE public.payroll_payments
  SET
    status = 'voided',
    voided_at = now(),
    voided_by = v_actor,
    void_reason = p_reason,
    updated_at = now()
  WHERE id = p_payment_id;

  -- Mark the corresponding financial_transaction as voided too
  IF v_payment.financial_tx_id IS NOT NULL THEN
    UPDATE public.financial_transactions
    SET
      status = 'voided',
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'voided', true,
        'void_reason', p_reason,
        'voided_at', now()::text
      ),
      updated_at = now()
    WHERE id = v_payment.financial_tx_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'voided_amount', v_payment.amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.void_payroll_payment(uuid, text) TO authenticated;

-- Done
