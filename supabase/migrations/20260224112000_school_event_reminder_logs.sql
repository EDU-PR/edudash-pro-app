-- Multi-threshold school event reminder idempotency log (7/3/1)

CREATE TABLE IF NOT EXISTS public.school_event_reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.school_events(id) ON DELETE CASCADE,
  preschool_id UUID NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
  reminder_offset_days INTEGER NOT NULL CHECK (reminder_offset_days IN (7, 3, 1)),
  reminder_label TEXT NOT NULL,
  target_role TEXT NOT NULL CHECK (target_role IN ('parent', 'teacher', 'student', 'all')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT school_event_reminder_logs_unique_threshold
    UNIQUE (event_id, reminder_offset_days, target_role)
);

CREATE INDEX IF NOT EXISTS idx_school_event_reminder_logs_event
  ON public.school_event_reminder_logs (event_id, reminder_offset_days);

CREATE INDEX IF NOT EXISTS idx_school_event_reminder_logs_school
  ON public.school_event_reminder_logs (preschool_id, sent_at DESC);

ALTER TABLE public.school_event_reminder_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_event_reminder_logs_staff_view ON public.school_event_reminder_logs;
CREATE POLICY school_event_reminder_logs_staff_view
  ON public.school_event_reminder_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('teacher', 'principal', 'principal_admin', 'admin', 'super_admin')
        AND COALESCE(p.organization_id, p.preschool_id) = school_event_reminder_logs.preschool_id
    )
  );

GRANT SELECT ON public.school_event_reminder_logs TO authenticated;
GRANT INSERT ON public.school_event_reminder_logs TO authenticated;
