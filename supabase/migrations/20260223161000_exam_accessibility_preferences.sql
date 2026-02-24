-- Migration: Exam Accessibility Preferences
-- Stores per-user accessibility settings for the exam interface.
-- Allows language preference, auto-read, font size, and voice answer mode to persist.

CREATE TABLE IF NOT EXISTS exam_accessibility_preferences (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Language preference (BCP-47 code)
  language      TEXT        NOT NULL DEFAULT 'en-ZA',
  -- Whether to auto-read questions aloud via TTS
  auto_read     BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Font size preference
  font_size     TEXT        NOT NULL DEFAULT 'normal'
                            CHECK (font_size IN ('normal', 'large', 'xlarge')),
  -- Whether voice answer mode is enabled
  voice_answer  BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Student's home language for in-question translations
  home_language TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION update_exam_accessibility_preferences_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_exam_accessibility_preferences_updated_at ON exam_accessibility_preferences;
CREATE TRIGGER trg_exam_accessibility_preferences_updated_at
  BEFORE UPDATE ON exam_accessibility_preferences
  FOR EACH ROW EXECUTE FUNCTION update_exam_accessibility_preferences_updated_at();

-- RLS
ALTER TABLE exam_accessibility_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY exam_accessibility_preferences_owner
  ON exam_accessibility_preferences
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Allow upsert from the client
GRANT SELECT, INSERT, UPDATE ON exam_accessibility_preferences TO authenticated;

-- ── exam_question_alt_texts ─────────────────────────────────────────────────
-- Caches per-question simplified and translated versions so we don't re-generate.

CREATE TABLE IF NOT EXISTS exam_question_alt_texts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id    TEXT        NOT NULL,   -- exam_generations.id or a stable hash
  question_id      TEXT        NOT NULL,   -- question.id within the exam
  user_id          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  alt_type         TEXT        NOT NULL CHECK (alt_type IN ('simplified', 'translated')),
  target_language  TEXT,                   -- BCP-47 code, NULL for simplified
  alt_text         TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (generation_id, question_id, alt_type, target_language)
);

ALTER TABLE exam_question_alt_texts ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read cached alt texts (they're not sensitive)
CREATE POLICY exam_question_alt_texts_select
  ON exam_question_alt_texts FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only the requesting user can insert their own alt texts
CREATE POLICY exam_question_alt_texts_insert
  ON exam_question_alt_texts FOR INSERT
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT ON exam_question_alt_texts TO authenticated;

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_exam_alt_texts_lookup
  ON exam_question_alt_texts (generation_id, question_id, alt_type, target_language);
