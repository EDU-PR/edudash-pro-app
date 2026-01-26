BEGIN;

ALTER TABLE public.uniform_requests
  ADD COLUMN IF NOT EXISTS is_returning boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tshirt_number text NULL;

COMMIT;
