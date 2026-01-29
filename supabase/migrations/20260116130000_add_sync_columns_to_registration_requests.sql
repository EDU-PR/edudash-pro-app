-- Add sync tracking columns to registration_requests table
-- These columns track the EduDash parent and student IDs created when registration is approved

DO $$
BEGIN
  IF to_regclass('public.registration_requests') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.registration_requests ADD COLUMN IF NOT EXISTS edudash_parent_id UUID';
  EXECUTE 'ALTER TABLE public.registration_requests ADD COLUMN IF NOT EXISTS edudash_student_id UUID';
  EXECUTE 'ALTER TABLE public.registration_requests ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ';

  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_registration_requests_edudash_parent_id
           ON public.registration_requests(edudash_parent_id) WHERE edudash_parent_id IS NOT NULL';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_registration_requests_edudash_student_id
           ON public.registration_requests(edudash_student_id) WHERE edudash_student_id IS NOT NULL';

  EXECUTE 'COMMENT ON COLUMN public.registration_requests.edudash_parent_id IS ''UUID of the parent profile created in EduDash when registration is approved''';
  EXECUTE 'COMMENT ON COLUMN public.registration_requests.edudash_student_id IS ''UUID of the student record created in EduDash when registration is approved''';
  EXECUTE 'COMMENT ON COLUMN public.registration_requests.synced_at IS ''Timestamp when the registration was synced to create parent/student records''';
END $$;
