BEGIN;

ALTER TABLE public.uniform_requests
  ADD COLUMN IF NOT EXISTS sample_supplied boolean NOT NULL DEFAULT false;

COMMIT;
