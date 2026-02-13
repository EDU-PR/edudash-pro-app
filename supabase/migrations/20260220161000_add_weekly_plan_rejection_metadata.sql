-- Weekly plans: persist rejection reason + reviewer metadata
-- Rejected plans return to 'draft' status, but now include:
--   - rejection_reason (required by UI when rejecting)
--   - rejected_at
--   - rejected_by

BEGIN;

ALTER TABLE public.weekly_plans
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMIT;

