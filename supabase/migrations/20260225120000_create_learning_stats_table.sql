-- Migration: Create learning session & streak tables for Dash Tutor stats
-- Tracks per-session data and cumulative streak / XP stats per user.

-- ============================================================================
-- 1. learning_sessions — one row per completed tutor session
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.learning_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid,
  session_mode  text NOT NULL DEFAULT 'practice',
  subject       text,
  grade         text,
  questions_answered integer NOT NULL DEFAULT 0,
  correct_answers    integer NOT NULL DEFAULT 0,
  xp_earned     integer NOT NULL DEFAULT 0,
  duration_seconds integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.learning_sessions IS 'Individual Dash Tutor session records for analytics and streak tracking.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_learning_sessions_user_id
  ON public.learning_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_learning_sessions_created_at
  ON public.learning_sessions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_learning_sessions_org_id
  ON public.learning_sessions (organization_id)
  WHERE organization_id IS NOT NULL;

-- RLS
ALTER TABLE public.learning_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY learning_sessions_select_own ON public.learning_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY learning_sessions_insert_own ON public.learning_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY learning_sessions_update_own ON public.learning_sessions
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 2. learning_streaks — one row per user; cumulative streak & XP counters
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.learning_streaks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak    integer NOT NULL DEFAULT 0,
  best_streak       integer NOT NULL DEFAULT 0,
  total_xp          integer NOT NULL DEFAULT 0,
  daily_goal        integer NOT NULL DEFAULT 3,
  last_session_date date,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.learning_streaks IS 'Cumulative streak and XP summary per user for the Dash Tutor.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_learning_streaks_user_id
  ON public.learning_streaks (user_id);

-- RLS
ALTER TABLE public.learning_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY learning_streaks_select_own ON public.learning_streaks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY learning_streaks_insert_own ON public.learning_streaks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY learning_streaks_update_own ON public.learning_streaks
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION public.set_learning_streaks_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_learning_streaks_updated_at ON public.learning_streaks;
CREATE TRIGGER trg_learning_streaks_updated_at
  BEFORE UPDATE ON public.learning_streaks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_learning_streaks_updated_at();
