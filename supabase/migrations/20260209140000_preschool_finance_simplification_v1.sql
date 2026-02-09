-- Preschool Finance Simplification v1
-- Principal-first billing month ledger + explicit allocations + unified payroll abstractions.

BEGIN;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.normalize_fee_category_code(p_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text := lower(trim(coalesce(p_value, '')));
BEGIN
  IF v = '' THEN
    RETURN 'tuition';
  END IF;

  IF v IN ('uniform_tshirt', 'uniform_shorts', 'uniform_set', 'uniforms') OR v LIKE 'uniform%' OR v ~ '\muniform\M' THEN
    RETURN 'uniform';
  ELSIF v IN ('registration', 'admission', 'enrolment', 'enrollment') OR v ~ '\m(registration|admission|enrolment|enrollment)\M' THEN
    RETURN 'registration';
  ELSIF v IN ('aftercare', 'after_care', 'after-care') OR v ~ '\mafter\s*care\M' THEN
    RETURN 'aftercare';
  ELSIF v IN ('transport', 'bus', 'shuttle') OR v ~ '\m(transport|bus|shuttle)\M' THEN
    RETURN 'transport';
  ELSIF v IN ('meal', 'food', 'catering', 'lunch', 'snack') OR v ~ '\m(meal|food|catering|lunch|snack)\M' THEN
    RETURN 'meal';
  ELSIF v IN ('tuition', 'school_fees', 'school_fee', 'monthly', 'fees') OR v ~ '\m(tuition|school\s*fee|monthly)\M' THEN
    RETURN 'tuition';
  ELSIF v IN ('ad_hoc', 'ad-hoc', 'adhoc', 'other') THEN
    RETURN 'ad_hoc';
  END IF;

  RETURN 'ad_hoc';
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_finance_payment_method(p_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text := lower(trim(coalesce(p_value, '')));
BEGIN
  IF v = '' THEN
    RETURN 'other';
  ELSIF v IN ('cash') THEN
    RETURN 'cash';
  ELSIF v IN ('card', 'card_payment', 'card payment') THEN
    RETURN 'card';
  ELSIF v IN ('bank_transfer', 'bank transfer') OR v ~ 'eft\s*/\s*bank\s*transfer' THEN
    RETURN 'bank_transfer';
  ELSIF v IN ('eft') THEN
    RETURN 'eft';
  ELSIF v IN ('debit_order', 'debit order') THEN
    RETURN 'debit_order';
  ELSIF v IN ('cheque', 'check') THEN
    RETURN 'cheque';
  ELSIF v IN ('mobile_payment', 'mobile payment') THEN
    RETURN 'mobile_payment';
  END IF;

  RETURN 'other';
END;
$$;

-- -----------------------------------------------------------------------------
-- Ledger fields on existing tables
-- -----------------------------------------------------------------------------

ALTER TABLE public.student_fees
  ADD COLUMN IF NOT EXISTS billing_month date,
  ADD COLUMN IF NOT EXISTS category_code text;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS billing_month date,
  ADD COLUMN IF NOT EXISTS category_code text,
  ADD COLUMN IF NOT EXISTS transaction_date date;

ALTER TABLE public.pop_uploads
  ADD COLUMN IF NOT EXISTS category_code text;

UPDATE public.student_fees sf
SET
  billing_month = date_trunc('month', coalesce(sf.due_date::timestamp, sf.created_at, now()))::date,
  category_code = public.normalize_fee_category_code(
    coalesce(fs.fee_type, '') || ' ' || coalesce(fs.name, '') || ' ' || coalesce(fs.description, '')
  )
FROM public.fee_structures fs
WHERE sf.fee_structure_id = fs.id
  AND (
    sf.billing_month IS NULL
    OR sf.category_code IS NULL
    OR btrim(coalesce(sf.category_code, '')) = ''
  );

UPDATE public.student_fees
SET
  billing_month = coalesce(billing_month, date_trunc('month', coalesce(due_date::timestamp, created_at, now()))::date),
  category_code = coalesce(nullif(btrim(category_code), ''), 'tuition')
WHERE billing_month IS NULL
   OR category_code IS NULL
   OR btrim(coalesce(category_code, '')) = '';

UPDATE public.payments
SET
  transaction_date = coalesce(
    nullif(metadata->>'payment_date', '')::date,
    submitted_at::date,
    created_at::date,
    current_date
  ),
  billing_month = date_trunc('month', coalesce(
    nullif(metadata->>'billing_month', '')::timestamp,
    nullif(metadata->>'payment_for_month', '')::timestamp,
    nullif(metadata->>'payment_date', '')::timestamp,
    submitted_at,
    created_at,
    now()
  ))::date,
  category_code = public.normalize_fee_category_code(coalesce(
    nullif(metadata->>'category_code', ''),
    nullif(metadata->>'fee_type', ''),
    nullif(metadata->>'payment_context', ''),
    nullif(metadata->>'fee_category', ''),
    description,
    'tuition'
  ));

UPDATE public.pop_uploads
SET category_code = public.normalize_fee_category_code(coalesce(description, title, 'tuition'))
WHERE upload_type = 'proof_of_payment'
  AND (category_code IS NULL OR btrim(coalesce(category_code, '')) = '');

ALTER TABLE public.student_fees
  ALTER COLUMN billing_month SET DEFAULT date_trunc('month', now())::date,
  ALTER COLUMN category_code SET DEFAULT 'tuition';

ALTER TABLE public.payments
  ALTER COLUMN billing_month SET DEFAULT date_trunc('month', now())::date,
  ALTER COLUMN category_code SET DEFAULT 'tuition',
  ALTER COLUMN transaction_date SET DEFAULT current_date;

ALTER TABLE public.pop_uploads
  ALTER COLUMN category_code SET DEFAULT 'ad_hoc';

UPDATE public.student_fees
SET billing_month = coalesce(billing_month, date_trunc('month', now())::date),
    category_code = coalesce(nullif(btrim(category_code), ''), 'tuition')
WHERE billing_month IS NULL OR category_code IS NULL OR btrim(coalesce(category_code, '')) = '';

UPDATE public.payments
SET billing_month = coalesce(billing_month, date_trunc('month', now())::date),
    category_code = coalesce(nullif(btrim(category_code), ''), 'tuition'),
    transaction_date = coalesce(transaction_date, current_date)
WHERE billing_month IS NULL OR category_code IS NULL OR transaction_date IS NULL
   OR btrim(coalesce(category_code, '')) = '';

ALTER TABLE public.student_fees
  ALTER COLUMN billing_month SET NOT NULL,
  ALTER COLUMN category_code SET NOT NULL;

ALTER TABLE public.payments
  ALTER COLUMN billing_month SET NOT NULL,
  ALTER COLUMN category_code SET NOT NULL,
  ALTER COLUMN transaction_date SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'student_fees_category_code_check'
      AND conrelid = 'public.student_fees'::regclass
  ) THEN
    ALTER TABLE public.student_fees
      ADD CONSTRAINT student_fees_category_code_check
      CHECK (category_code = ANY (ARRAY['tuition','registration','uniform','aftercare','transport','meal','ad_hoc']));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_category_code_check'
      AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_category_code_check
      CHECK (category_code = ANY (ARRAY['tuition','registration','uniform','aftercare','transport','meal','ad_hoc']));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pop_uploads_category_code_required_check'
      AND conrelid = 'public.pop_uploads'::regclass
  ) THEN
    ALTER TABLE public.pop_uploads
      ADD CONSTRAINT pop_uploads_category_code_required_check
      CHECK (
        upload_type <> 'proof_of_payment'
        OR (category_code IS NOT NULL AND btrim(category_code) <> '')
      );
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.sync_student_fee_ledger_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_category text;
BEGIN
  IF NEW.billing_month IS NULL THEN
    NEW.billing_month := date_trunc('month', coalesce(NEW.due_date::timestamp, now()))::date;
  ELSE
    NEW.billing_month := date_trunc('month', NEW.billing_month::timestamp)::date;
  END IF;

  IF NEW.category_code IS NULL OR btrim(NEW.category_code) = '' THEN
    SELECT public.normalize_fee_category_code(
      coalesce(fs.fee_type, '') || ' ' || coalesce(fs.name, '') || ' ' || coalesce(fs.description, '')
    )
    INTO v_category
    FROM public.fee_structures fs
    WHERE fs.id = NEW.fee_structure_id
    LIMIT 1;

    NEW.category_code := coalesce(v_category, 'tuition');
  ELSE
    NEW.category_code := public.normalize_fee_category_code(NEW.category_code);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_student_fee_ledger_fields ON public.student_fees;
CREATE TRIGGER trg_sync_student_fee_ledger_fields
BEFORE INSERT OR UPDATE ON public.student_fees
FOR EACH ROW
EXECUTE FUNCTION public.sync_student_fee_ledger_fields();

CREATE OR REPLACE FUNCTION public.sync_payment_ledger_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_month_source date;
BEGIN
  IF NEW.transaction_date IS NULL THEN
    NEW.transaction_date := coalesce(
      nullif(NEW.metadata->>'payment_date', '')::date,
      NEW.submitted_at::date,
      NEW.created_at::date,
      current_date
    );
  END IF;

  v_month_source := coalesce(
    nullif(NEW.metadata->>'billing_month', '')::date,
    nullif(NEW.metadata->>'payment_for_month', '')::date,
    NEW.billing_month,
    NEW.transaction_date,
    NEW.created_at::date,
    current_date
  );

  NEW.billing_month := date_trunc('month', v_month_source::timestamp)::date;

  IF NEW.category_code IS NULL OR btrim(NEW.category_code) = '' THEN
    NEW.category_code := public.normalize_fee_category_code(coalesce(
      nullif(NEW.metadata->>'category_code', ''),
      nullif(NEW.metadata->>'fee_type', ''),
      nullif(NEW.metadata->>'payment_context', ''),
      nullif(NEW.metadata->>'fee_category', ''),
      NEW.description,
      'tuition'
    ));
  ELSE
    NEW.category_code := public.normalize_fee_category_code(NEW.category_code);
  END IF;

  IF NEW.payment_method IS NOT NULL THEN
    NEW.payment_method := public.normalize_finance_payment_method(NEW.payment_method);
  END IF;

  NEW.metadata := coalesce(NEW.metadata, '{}'::jsonb) || jsonb_build_object(
    'billing_month', NEW.billing_month::text,
    'category_code', NEW.category_code,
    'transaction_date', NEW.transaction_date::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_payment_ledger_fields ON public.payments;
CREATE TRIGGER trg_sync_payment_ledger_fields
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.sync_payment_ledger_fields();

CREATE OR REPLACE FUNCTION public.sync_pop_upload_finance_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.upload_type = 'proof_of_payment' THEN
    IF NEW.payment_for_month IS NULL THEN
      NEW.payment_for_month := coalesce(NEW.payment_date, current_date);
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

DROP TRIGGER IF EXISTS trg_sync_pop_upload_finance_fields ON public.pop_uploads;
CREATE TRIGGER trg_sync_pop_upload_finance_fields
BEFORE INSERT OR UPDATE ON public.pop_uploads
FOR EACH ROW
EXECUTE FUNCTION public.sync_pop_upload_finance_fields();

CREATE INDEX IF NOT EXISTS idx_student_fees_billing_month_category
  ON public.student_fees (billing_month, category_code);

CREATE INDEX IF NOT EXISTS idx_payments_billing_month_category
  ON public.payments (billing_month, category_code);

CREATE INDEX IF NOT EXISTS idx_pop_uploads_category_code
  ON public.pop_uploads (category_code)
  WHERE upload_type = 'proof_of_payment';

-- -----------------------------------------------------------------------------
-- New ledger + payroll tables
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  student_fee_id uuid NOT NULL REFERENCES public.student_fees(id) ON DELETE CASCADE,
  allocated_amount numeric(12,2) NOT NULL CHECK (allocated_amount > 0),
  billing_month date NOT NULL,
  category_code text NOT NULL DEFAULT 'tuition',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_id, student_fee_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_allocations_category_code_check'
      AND conrelid = 'public.payment_allocations'::regclass
  ) THEN
    ALTER TABLE public.payment_allocations
      ADD CONSTRAINT payment_allocations_category_code_check
      CHECK (category_code = ANY (ARRAY['tuition','registration','uniform','aftercare','transport','meal','ad_hoc']));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON public.payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_fee ON public.payment_allocations(student_fee_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_billing_month ON public.payment_allocations(billing_month, category_code);

CREATE TABLE IF NOT EXISTS public.family_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  preschool_id uuid NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
  category_code text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  remaining_amount numeric(12,2) NOT NULL CHECK (remaining_amount >= 0),
  origin_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'available',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'family_credits_category_code_check'
      AND conrelid = 'public.family_credits'::regclass
  ) THEN
    ALTER TABLE public.family_credits
      ADD CONSTRAINT family_credits_category_code_check
      CHECK (category_code = ANY (ARRAY['tuition','registration','uniform','aftercare','transport','meal','ad_hoc']));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'family_credits_status_check'
      AND conrelid = 'public.family_credits'::regclass
  ) THEN
    ALTER TABLE public.family_credits
      ADD CONSTRAINT family_credits_status_check
      CHECK (status = ANY (ARRAY['available','reserved','applied','refunded','expired']));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_family_credits_org_status ON public.family_credits(preschool_id, status);
CREATE INDEX IF NOT EXISTS idx_family_credits_parent ON public.family_credits(parent_id);

CREATE TABLE IF NOT EXISTS public.payroll_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
  role_type text NOT NULL,
  teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payroll_recipients_role_type_check'
      AND conrelid = 'public.payroll_recipients'::regclass
  ) THEN
    ALTER TABLE public.payroll_recipients
      ADD CONSTRAINT payroll_recipients_role_type_check
      CHECK (role_type = ANY (ARRAY['teacher','principal']));
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_payroll_recipients_teacher
  ON public.payroll_recipients(organization_id, teacher_id)
  WHERE teacher_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_payroll_recipients_principal_profile
  ON public.payroll_recipients(organization_id, role_type, profile_id)
  WHERE role_type = 'principal' AND profile_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.payroll_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_recipient_id uuid NOT NULL REFERENCES public.payroll_recipients(id) ON DELETE CASCADE,
  base_salary numeric(12,2) NOT NULL DEFAULT 0,
  allowances numeric(12,2) NOT NULL DEFAULT 0,
  deductions numeric(12,2) NOT NULL DEFAULT 0,
  net_salary numeric(12,2) GENERATED ALWAYS AS (base_salary + allowances - deductions) STORED,
  effective_from date NOT NULL DEFAULT current_date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_profiles_recipient_effective
  ON public.payroll_profiles(payroll_recipient_id, effective_from DESC);

CREATE TABLE IF NOT EXISTS public.payroll_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_recipient_id uuid NOT NULL REFERENCES public.payroll_recipients(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_month date NOT NULL,
  payment_method text NOT NULL DEFAULT 'bank_transfer',
  payment_reference text,
  notes text,
  financial_tx_id uuid REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payroll_payments_method_check'
      AND conrelid = 'public.payroll_payments'::regclass
  ) THEN
    ALTER TABLE public.payroll_payments
      ADD CONSTRAINT payroll_payments_method_check
      CHECK (payment_method = ANY (ARRAY['bank_transfer','cash','cheque','eft','card','debit_order','mobile_payment','other']));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_payroll_payments_org_month
  ON public.payroll_payments(organization_id, payment_month DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_payments_recipient
  ON public.payroll_payments(payroll_recipient_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.finance_month_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
  month date NOT NULL,
  is_locked boolean NOT NULL DEFAULT true,
  locked_at timestamptz NOT NULL DEFAULT now(),
  locked_by uuid NOT NULL,
  notes text,
  reopened_at timestamptz,
  reopened_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, month)
);

-- -----------------------------------------------------------------------------
-- RLS for new tables
-- -----------------------------------------------------------------------------

ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_month_closures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_allocations_org_select ON public.payment_allocations;
CREATE POLICY payment_allocations_org_select
ON public.payment_allocations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.payments p
    JOIN public.profiles actor
      ON (actor.id = auth.uid() OR actor.auth_user_id = auth.uid())
    WHERE p.id = payment_allocations.payment_id
      AND COALESCE(actor.organization_id, actor.preschool_id) = p.preschool_id
      AND lower(actor.role) IN ('admin','principal','principal_admin','super_admin','superadmin','teacher')
  )
);

DROP POLICY IF EXISTS payment_allocations_org_insert ON public.payment_allocations;
CREATE POLICY payment_allocations_org_insert
ON public.payment_allocations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.payments p
    JOIN public.profiles actor
      ON (actor.id = auth.uid() OR actor.auth_user_id = auth.uid())
    WHERE p.id = payment_allocations.payment_id
      AND COALESCE(actor.organization_id, actor.preschool_id) = p.preschool_id
      AND lower(actor.role) IN ('admin','principal','principal_admin','super_admin','superadmin')
  )
);

DROP POLICY IF EXISTS family_credits_org_select ON public.family_credits;
CREATE POLICY family_credits_org_select
ON public.family_credits
FOR SELECT
TO authenticated
USING (
  preschool_id IN (
    SELECT COALESCE(p.organization_id, p.preschool_id)
    FROM public.profiles p
    WHERE p.id = auth.uid() OR p.auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS family_credits_org_modify ON public.family_credits;
CREATE POLICY family_credits_org_modify
ON public.family_credits
FOR ALL
TO authenticated
USING (
  preschool_id IN (
    SELECT COALESCE(p.organization_id, p.preschool_id)
    FROM public.profiles p
    WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
      AND lower(p.role) IN ('admin','principal','principal_admin','super_admin','superadmin')
  )
)
WITH CHECK (
  preschool_id IN (
    SELECT COALESCE(p.organization_id, p.preschool_id)
    FROM public.profiles p
    WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
      AND lower(p.role) IN ('admin','principal','principal_admin','super_admin','superadmin')
  )
);

DROP POLICY IF EXISTS payroll_recipients_org_access ON public.payroll_recipients;
CREATE POLICY payroll_recipients_org_access
ON public.payroll_recipients
FOR ALL
TO authenticated
USING (
  organization_id IN (
    SELECT COALESCE(p.organization_id, p.preschool_id)
    FROM public.profiles p
    WHERE p.id = auth.uid() OR p.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT COALESCE(p.organization_id, p.preschool_id)
    FROM public.profiles p
    WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
      AND lower(p.role) IN ('admin','principal','principal_admin','super_admin','superadmin')
  )
);

DROP POLICY IF EXISTS payroll_profiles_org_access ON public.payroll_profiles;
CREATE POLICY payroll_profiles_org_access
ON public.payroll_profiles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.payroll_recipients pr
    JOIN public.profiles actor
      ON (actor.id = auth.uid() OR actor.auth_user_id = auth.uid())
    WHERE pr.id = payroll_profiles.payroll_recipient_id
      AND pr.organization_id = COALESCE(actor.organization_id, actor.preschool_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.payroll_recipients pr
    JOIN public.profiles actor
      ON (actor.id = auth.uid() OR actor.auth_user_id = auth.uid())
    WHERE pr.id = payroll_profiles.payroll_recipient_id
      AND pr.organization_id = COALESCE(actor.organization_id, actor.preschool_id)
      AND lower(actor.role) IN ('admin','principal','principal_admin','super_admin','superadmin')
  )
);

DROP POLICY IF EXISTS payroll_payments_org_access ON public.payroll_payments;
CREATE POLICY payroll_payments_org_access
ON public.payroll_payments
FOR ALL
TO authenticated
USING (
  organization_id IN (
    SELECT COALESCE(p.organization_id, p.preschool_id)
    FROM public.profiles p
    WHERE p.id = auth.uid() OR p.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT COALESCE(p.organization_id, p.preschool_id)
    FROM public.profiles p
    WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
      AND lower(p.role) IN ('admin','principal','principal_admin','super_admin','superadmin')
  )
);

DROP POLICY IF EXISTS finance_month_closures_org_access ON public.finance_month_closures;
CREATE POLICY finance_month_closures_org_access
ON public.finance_month_closures
FOR ALL
TO authenticated
USING (
  organization_id IN (
    SELECT COALESCE(p.organization_id, p.preschool_id)
    FROM public.profiles p
    WHERE p.id = auth.uid() OR p.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT COALESCE(p.organization_id, p.preschool_id)
    FROM public.profiles p
    WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
      AND lower(p.role) IN ('principal','principal_admin','super_admin','superadmin')
  )
);

-- -----------------------------------------------------------------------------
-- RPC: approve_pop_payment
-- -----------------------------------------------------------------------------

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

  -- Explicit allocations supplied from client.
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

  -- Default allocation: same billing month + category, create fee row if missing.
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

  -- Recompute fee states from allocations.
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

-- -----------------------------------------------------------------------------
-- RPC: get_finance_month_snapshot
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
  v_month_end date := (date_trunc('month', coalesce(p_month, current_date)) + INTERVAL '1 month')::date;
  v_due numeric(12,2) := 0;
  v_collected numeric(12,2) := 0;
  v_outstanding numeric(12,2) := 0;
  v_prepaid numeric(12,2) := 0;
  v_payroll_due numeric(12,2) := 0;
  v_payroll_paid numeric(12,2) := 0;
  v_pending_pop int := 0;
  v_month_locked boolean := false;
  v_categories jsonb := '[]'::jsonb;
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

  SELECT coalesce(sum(sf.final_amount), 0),
         coalesce(sum(sf.amount_outstanding), 0)
  INTO v_due, v_outstanding
  FROM public.student_fees sf
  JOIN public.students s ON s.id = sf.student_id
  WHERE COALESCE(s.organization_id, s.preschool_id) = p_org_id
    AND sf.billing_month = v_month
    AND sf.status <> 'waived';

  SELECT coalesce(sum(pa.allocated_amount), 0)
  INTO v_collected
  FROM public.payment_allocations pa
  JOIN public.payments p ON p.id = pa.payment_id
  WHERE p.preschool_id = p_org_id
    AND pa.billing_month = v_month
    AND p.status IN ('completed', 'approved');

  SELECT coalesce(sum(pa.allocated_amount), 0)
  INTO v_prepaid
  FROM public.payment_allocations pa
  JOIN public.payments p ON p.id = pa.payment_id
  WHERE p.preschool_id = p_org_id
    AND pa.billing_month > v_month
    AND date_trunc('month', p.transaction_date::timestamp)::date <= v_month
    AND p.status IN ('completed', 'approved');

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

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'category_code', t.category_code,
        'due', t.due,
        'collected', t.collected,
        'outstanding', greatest(t.due - t.collected, 0)
      )
      ORDER BY t.category_code
    ),
    '[]'::jsonb
  )
  INTO v_categories
  FROM (
    SELECT
      sf.category_code,
      round(coalesce(sum(sf.final_amount), 0), 2) AS due,
      round(coalesce(sum(pa.allocated_amount), 0), 2) AS collected
    FROM public.student_fees sf
    JOIN public.students s ON s.id = sf.student_id
    LEFT JOIN public.payment_allocations pa
      ON pa.student_fee_id = sf.id
      AND pa.billing_month = v_month
    WHERE COALESCE(s.organization_id, s.preschool_id) = p_org_id
      AND sf.billing_month = v_month
    GROUP BY sf.category_code
  ) t;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', p_org_id,
    'month', v_month,
    'month_locked', v_month_locked,
    'due_this_month', round(coalesce(v_due, 0), 2),
    'collected_this_month', round(coalesce(v_collected, 0), 2),
    'still_outstanding', round(coalesce(v_outstanding, greatest(v_due - v_collected, 0)), 2),
    'prepaid_for_future_months', round(coalesce(v_prepaid, 0), 2),
    'payroll_due', round(coalesce(v_payroll_due, 0), 2),
    'payroll_paid', round(coalesce(v_payroll_paid, 0), 2),
    'pending_pop_reviews', v_pending_pop,
    'categories', v_categories,
    'generated_at', now()
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC: get_payroll_roster
-- -----------------------------------------------------------------------------

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
  ON CONFLICT (organization_id, teacher_id)
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
  ON CONFLICT (organization_id, role_type, profile_id)
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

-- -----------------------------------------------------------------------------
-- RPC: record_payroll_payment
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_payroll_payment(
  p_payroll_recipient_id uuid,
  p_amount numeric,
  p_payment_month date,
  p_payment_method text,
  p_reference text DEFAULT NULL,
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
  v_payment_month date := date_trunc('month', coalesce(p_payment_month, current_date))::date;
  v_method text := public.normalize_finance_payment_method(p_payment_method);
  v_recipient public.payroll_recipients%ROWTYPE;
  v_month_locked boolean := false;
  v_financial_tx_id uuid;
  v_payroll_payment_id uuid;
  v_role_label text;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF coalesce(p_amount, 0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment amount must be greater than zero');
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
  INTO v_recipient
  FROM public.payroll_recipients
  WHERE id = p_payroll_recipient_id
    AND active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payroll recipient not found');
  END IF;

  IF NOT v_is_super AND v_actor_org IS DISTINCT FROM v_recipient.organization_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cross-organization access denied');
  END IF;

  SELECT exists(
    SELECT 1
    FROM public.finance_month_closures fmc
    WHERE fmc.organization_id = v_recipient.organization_id
      AND fmc.month = v_payment_month
      AND fmc.is_locked = true
  )
  INTO v_month_locked;

  IF v_month_locked THEN
    RETURN jsonb_build_object('success', false, 'error', 'Selected month is locked');
  END IF;

  v_role_label := CASE WHEN v_recipient.role_type = 'principal' THEN 'Principal' ELSE 'Teacher' END;

  INSERT INTO public.financial_transactions (
    preschool_id,
    type,
    amount,
    description,
    payment_method,
    payment_reference,
    status,
    created_by,
    metadata
  )
  VALUES (
    v_recipient.organization_id,
    'expense',
    round(p_amount, 2),
    format('%s payroll payment - %s', v_role_label, v_recipient.display_name),
    v_method,
    nullif(p_reference, ''),
    'completed',
    v_actor,
    jsonb_build_object(
      'category', 'payroll',
      'payment_month', v_payment_month::text,
      'recipient_role', v_recipient.role_type,
      'recipient_id', v_recipient.id,
      'recipient_name', v_recipient.display_name
    )
  )
  RETURNING id INTO v_financial_tx_id;

  INSERT INTO public.payroll_payments (
    payroll_recipient_id,
    organization_id,
    amount,
    payment_month,
    payment_method,
    payment_reference,
    notes,
    financial_tx_id,
    recorded_by,
    updated_at
  )
  VALUES (
    v_recipient.id,
    v_recipient.organization_id,
    round(p_amount, 2),
    v_payment_month,
    v_method,
    nullif(p_reference, ''),
    nullif(p_notes, ''),
    v_financial_tx_id,
    v_actor,
    now()
  )
  RETURNING id INTO v_payroll_payment_id;

  -- Keep backward compatibility with teacher_payments history table.
  INSERT INTO public.teacher_payments (
    teacher_id,
    preschool_id,
    amount,
    payment_date,
    payment_method,
    payment_type,
    recipient_role,
    recipient_name,
    reference_number,
    notes,
    financial_tx_id,
    recorded_by
  )
  VALUES (
    CASE WHEN v_recipient.role_type = 'teacher' THEN v_recipient.teacher_id ELSE NULL END,
    v_recipient.organization_id,
    round(p_amount, 2),
    current_date,
    v_method,
    'salary',
    v_recipient.role_type,
    v_recipient.display_name,
    nullif(p_reference, ''),
    nullif(p_notes, ''),
    v_financial_tx_id,
    v_actor
  );

  RETURN jsonb_build_object(
    'success', true,
    'payroll_payment_id', v_payroll_payment_id,
    'financial_tx_id', v_financial_tx_id,
    'organization_id', v_recipient.organization_id,
    'payment_month', v_payment_month,
    'recipient_role', v_recipient.role_type,
    'recipient_name', v_recipient.display_name
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC: close_finance_month
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.close_finance_month(
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
  IF lower(v_actor_role) NOT IN ('principal', 'principal_admin', 'super_admin', 'superadmin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only principals can close finance months');
  END IF;

  IF NOT v_is_super AND v_actor_org IS DISTINCT FROM p_org_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cross-organization access denied');
  END IF;

  INSERT INTO public.finance_month_closures (
    organization_id,
    month,
    is_locked,
    locked_at,
    locked_by,
    updated_at
  )
  VALUES (
    p_org_id,
    v_month,
    true,
    now(),
    v_actor,
    now()
  )
  ON CONFLICT (organization_id, month)
  DO UPDATE SET
    is_locked = true,
    locked_at = now(),
    locked_by = EXCLUDED.locked_by,
    reopened_at = null,
    reopened_by = null,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', p_org_id,
    'month', v_month,
    'locked', true,
    'locked_by', v_actor,
    'locked_at', now()
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.approve_pop_payment(uuid, date, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_finance_month_snapshot(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_payroll_roster(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_payroll_payment(uuid, numeric, date, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_finance_month(uuid, date) TO authenticated;

COMMIT;
