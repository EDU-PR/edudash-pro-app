-- Meeting and excursion reminder idempotency logs (7/3/1 day thresholds)
-- Used by calendar-reminders-cron for meeting/excursion reminders

BEGIN;

CREATE TABLE IF NOT EXISTS public.school_meeting_reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.school_meetings(id) ON DELETE CASCADE,
  preschool_id UUID NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
  reminder_offset_days INTEGER NOT NULL CHECK (reminder_offset_days IN (7, 3, 1)),
  reminder_label TEXT NOT NULL,
  target_role TEXT NOT NULL DEFAULT 'all' CHECK (target_role IN ('parent', 'teacher', 'principal', 'all')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT school_meeting_reminder_logs_unique UNIQUE (meeting_id, reminder_offset_days, target_role)
);

CREATE INDEX IF NOT EXISTS idx_school_meeting_reminder_logs_meeting
  ON public.school_meeting_reminder_logs (meeting_id, reminder_offset_days);

ALTER TABLE public.school_meeting_reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.school_excursion_reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  excursion_id UUID NOT NULL REFERENCES public.school_excursions(id) ON DELETE CASCADE,
  preschool_id UUID NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
  reminder_offset_days INTEGER NOT NULL CHECK (reminder_offset_days IN (7, 3, 1)),
  reminder_label TEXT NOT NULL,
  target_role TEXT NOT NULL DEFAULT 'all' CHECK (target_role IN ('parent', 'teacher', 'principal', 'all')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT school_excursion_reminder_logs_unique UNIQUE (excursion_id, reminder_offset_days, target_role)
);

CREATE INDEX IF NOT EXISTS idx_school_excursion_reminder_logs_excursion
  ON public.school_excursion_reminder_logs (excursion_id, reminder_offset_days);

ALTER TABLE public.school_excursion_reminder_logs ENABLE ROW LEVEL SECURITY;

COMMIT;
