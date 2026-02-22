-- Immutable audit trail for principal/admin fee correction actions.
-- Covers waive, adjust, mark paid/unpaid, class change, and tuition sync.

CREATE TABLE IF NOT EXISTS public.fee_corrections_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  student_fee_id uuid NULL REFERENCES public.student_fees(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (
    action IN (
      'waive',
      'adjust',
      'mark_paid',
      'mark_unpaid',
      'change_class',
      'tuition_sync',
      'registration_paid',
      'registration_unpaid'
    )
  ),
  reason text NOT NULL,
  before_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NULL,
  created_by_role text NULL,
  source_screen text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fee_corrections_audit_org_created_at
  ON public.fee_corrections_audit(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fee_corrections_audit_student_created_at
  ON public.fee_corrections_audit(student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fee_corrections_audit_action_created_at
  ON public.fee_corrections_audit(action, created_at DESC);

CREATE OR REPLACE FUNCTION public.prevent_fee_corrections_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'fee_corrections_audit is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_fee_corrections_audit_no_update ON public.fee_corrections_audit;
CREATE TRIGGER trg_fee_corrections_audit_no_update
  BEFORE UPDATE ON public.fee_corrections_audit
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_fee_corrections_audit_mutation();

DROP TRIGGER IF EXISTS trg_fee_corrections_audit_no_delete ON public.fee_corrections_audit;
CREATE TRIGGER trg_fee_corrections_audit_no_delete
  BEFORE DELETE ON public.fee_corrections_audit
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_fee_corrections_audit_mutation();

ALTER TABLE public.fee_corrections_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fee_corrections_audit_select_school_staff ON public.fee_corrections_audit;
CREATE POLICY fee_corrections_audit_select_school_staff
ON public.fee_corrections_audit
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.organization_id = fee_corrections_audit.organization_id
        OR p.preschool_id = fee_corrections_audit.organization_id
      )
      AND p.role IN ('principal','principal_admin','admin','super_admin','superadmin','teacher')
  )
);

DROP POLICY IF EXISTS fee_corrections_audit_insert_school_admin ON public.fee_corrections_audit;
CREATE POLICY fee_corrections_audit_insert_school_admin
ON public.fee_corrections_audit
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.organization_id = fee_corrections_audit.organization_id
        OR p.preschool_id = fee_corrections_audit.organization_id
      )
      AND p.role IN ('principal','principal_admin','admin','super_admin','superadmin')
  )
);

COMMENT ON TABLE public.fee_corrections_audit IS
  'Append-only fee correction audit trail for principal/admin finance actions.';
