-- Migration: Create exam_history table for storing generated exams
-- Allows users to save, list, and manage their AI-generated exam papers.

CREATE TABLE IF NOT EXISTS public.exam_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid,
  grade         text,
  subject       text,
  exam_type     text,
  language      text,
  term          smallint,
  topics        text[],
  content       text NOT NULL,
  title         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups by user, ordered by recency
CREATE INDEX IF NOT EXISTS idx_exam_history_user_created
  ON public.exam_history (user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.exam_history ENABLE ROW LEVEL SECURITY;

-- Users can read their own exam history
DROP POLICY IF EXISTS exam_history_select_own ON public.exam_history;
CREATE POLICY exam_history_select_own ON public.exam_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own exams
DROP POLICY IF EXISTS exam_history_insert_own ON public.exam_history;
CREATE POLICY exam_history_insert_own ON public.exam_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own exams
DROP POLICY IF EXISTS exam_history_delete_own ON public.exam_history;
CREATE POLICY exam_history_delete_own ON public.exam_history
  FOR DELETE
  USING (auth.uid() = user_id);
