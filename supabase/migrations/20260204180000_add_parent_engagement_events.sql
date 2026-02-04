-- Create parent_engagement_events table for tracking notification engagement

BEGIN;

CREATE TABLE IF NOT EXISTS public.parent_engagement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id uuid REFERENCES public.preschools(id) ON DELETE SET NULL,
  parent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parent_engagement_events_parent_id
  ON public.parent_engagement_events(parent_id);

CREATE INDEX IF NOT EXISTS idx_parent_engagement_events_preschool_id
  ON public.parent_engagement_events(preschool_id);

CREATE INDEX IF NOT EXISTS idx_parent_engagement_events_type_created_at
  ON public.parent_engagement_events(event_type, created_at DESC);

ALTER TABLE public.parent_engagement_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Parent engagement events select own" ON public.parent_engagement_events;
DROP POLICY IF EXISTS "Parent engagement events insert service role" ON public.parent_engagement_events;

CREATE POLICY "Parent engagement events select own" ON public.parent_engagement_events
  FOR SELECT
  USING (auth.uid() = parent_id);

CREATE POLICY "Parent engagement events insert service role" ON public.parent_engagement_events
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
