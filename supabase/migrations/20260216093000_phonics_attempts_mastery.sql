-- Migration: Phonics attempt tracking + mastery heatmap
-- Purpose:
-- 1) Store per-attempt Azure pronunciation assessment metadata.
-- 2) Expose a parent-facing mastery view by phoneme.
-- 3) Enforce RLS so users can only read/write their own attempts.

CREATE TABLE IF NOT EXISTS public.phonics_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  target_word TEXT NOT NULL,
  target_phoneme TEXT NOT NULL,
  accuracy_score REAL,
  fluency_score REAL,
  completeness_score REAL,
  pron_score REAL,
  phoneme_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Stores storage path (preferred) or external URL fallback.
  audio_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phonics_attempts_user_created
  ON public.phonics_attempts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_phonics_attempts_user_lang_phoneme
  ON public.phonics_attempts (user_id, language_code, target_phoneme);

CREATE INDEX IF NOT EXISTS idx_phonics_attempts_created
  ON public.phonics_attempts (created_at DESC);

ALTER TABLE public.phonics_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS phonics_attempts_select_own ON public.phonics_attempts;
CREATE POLICY phonics_attempts_select_own
  ON public.phonics_attempts
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS phonics_attempts_insert_own ON public.phonics_attempts;
CREATE POLICY phonics_attempts_insert_own
  ON public.phonics_attempts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS phonics_attempts_update_own ON public.phonics_attempts;
CREATE POLICY phonics_attempts_update_own
  ON public.phonics_attempts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS phonics_attempts_delete_own ON public.phonics_attempts;
CREATE POLICY phonics_attempts_delete_own
  ON public.phonics_attempts
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE VIEW public.phoneme_mastery
WITH (security_invoker = true) AS
SELECT
  user_id,
  language_code,
  target_phoneme,
  AVG(accuracy_score) AS avg_accuracy,
  COUNT(id) AS total_attempts
FROM public.phonics_attempts
GROUP BY user_id, language_code, target_phoneme;

GRANT SELECT ON public.phonics_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.phonics_attempts TO authenticated;
GRANT SELECT ON public.phoneme_mastery TO authenticated;

COMMENT ON TABLE public.phonics_attempts IS
  'Per-attempt phonics pronunciation assessments with phoneme-level Azure metadata.';

COMMENT ON VIEW public.phoneme_mastery IS
  'Aggregated phoneme mastery heatmap source grouped by user, language, and target phoneme.';
