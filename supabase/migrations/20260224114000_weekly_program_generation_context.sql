-- Store routine planner preflight metadata on weekly programs

ALTER TABLE public.weekly_programs
  ADD COLUMN IF NOT EXISTS generation_context JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_weekly_programs_generation_context
  ON public.weekly_programs
  USING GIN (generation_context);
