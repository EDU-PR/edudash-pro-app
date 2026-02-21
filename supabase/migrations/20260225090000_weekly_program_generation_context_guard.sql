-- Guard migration: ensure weekly_programs.generation_context is present and indexed.

BEGIN;

ALTER TABLE public.weekly_programs
  ADD COLUMN IF NOT EXISTS generation_context jsonb;

ALTER TABLE public.weekly_programs
  ALTER COLUMN generation_context SET DEFAULT '{}'::jsonb;

UPDATE public.weekly_programs
SET generation_context = '{}'::jsonb
WHERE generation_context IS NULL;

ALTER TABLE public.weekly_programs
  ALTER COLUMN generation_context SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_weekly_programs_generation_context
  ON public.weekly_programs
  USING GIN (generation_context);

COMMIT;
