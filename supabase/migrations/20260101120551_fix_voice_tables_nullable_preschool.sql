-- Fix voice tables to allow null preschool_id (for parents who may not have a preschool)
-- Also fixes missing tables if they don't exist

-- ==== tts_audio_cache table ====
-- Create if not exists with nullable preschool_id
CREATE TABLE IF NOT EXISTS public.tts_audio_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID REFERENCES public.preschools(id) ON DELETE CASCADE, -- Now nullable
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Added user_id
  hash TEXT NOT NULL,
  text TEXT NOT NULL,
  language_code TEXT NOT NULL,
  voice_id TEXT,
  provider TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes INTEGER,
  hit_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Drop NOT NULL constraint if it exists (for existing tables)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'tts_audio_cache' 
      AND column_name = 'preschool_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.tts_audio_cache ALTER COLUMN preschool_id DROP NOT NULL;
  END IF;
END $$;

-- Add user_id column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'tts_audio_cache' 
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.tts_audio_cache ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes if not exists
CREATE INDEX IF NOT EXISTS idx_tts_cache_hash ON public.tts_audio_cache(hash);
CREATE INDEX IF NOT EXISTS idx_tts_cache_user ON public.tts_audio_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_tts_cache_preschool_lang ON public.tts_audio_cache(preschool_id, language_code);
CREATE INDEX IF NOT EXISTS idx_tts_cache_provider ON public.tts_audio_cache(provider);
CREATE INDEX IF NOT EXISTS idx_tts_cache_last_used ON public.tts_audio_cache(last_used_at);

-- Make hash unique if not already
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'tts_audio_cache' 
      AND indexname = 'tts_audio_cache_hash_key'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tts_audio_cache_hash_key'
  ) THEN
    -- Check if there's a unique constraint already
    BEGIN
      ALTER TABLE public.tts_audio_cache ADD CONSTRAINT tts_audio_cache_hash_unique UNIQUE (hash);
    EXCEPTION WHEN duplicate_table THEN
      NULL; -- Constraint already exists
    END;
  END IF;
END $$;

-- ==== voice_usage_logs table ====
-- Create if not exists with nullable preschool_id
CREATE TABLE IF NOT EXISTS public.voice_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID REFERENCES public.preschools(id) ON DELETE CASCADE, -- Now nullable
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  service TEXT NOT NULL CHECK (service IN ('tts', 'stt')),
  provider TEXT NOT NULL,
  language_code TEXT NOT NULL,
  units NUMERIC NOT NULL,
  cost_estimate_usd NUMERIC,
  latency_ms INTEGER,
  success BOOLEAN DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Drop NOT NULL constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'voice_usage_logs' 
      AND column_name = 'preschool_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.voice_usage_logs ALTER COLUMN preschool_id DROP NOT NULL;
  END IF;
END $$;

-- Create indexes if not exists
CREATE INDEX IF NOT EXISTS idx_voice_usage_user ON public.voice_usage_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_usage_preschool_date ON public.voice_usage_logs(preschool_id, created_at);
CREATE INDEX IF NOT EXISTS idx_voice_usage_service ON public.voice_usage_logs(service, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_usage_lang ON public.voice_usage_logs(language_code);
CREATE INDEX IF NOT EXISTS idx_voice_usage_provider ON public.voice_usage_logs(provider);

-- ==== RLS Policies ====
-- Enable RLS
ALTER TABLE public.tts_audio_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_usage_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "tts_cache_user_read" ON public.tts_audio_cache;
DROP POLICY IF EXISTS "tts_cache_user_insert" ON public.tts_audio_cache;
DROP POLICY IF EXISTS "tts_cache_service_role" ON public.tts_audio_cache;
DROP POLICY IF EXISTS "voice_logs_user_read" ON public.voice_usage_logs;
DROP POLICY IF EXISTS "voice_logs_service_role" ON public.voice_usage_logs;

-- TTS Cache policies
-- Users can read cache entries they created or from their preschool
CREATE POLICY "tts_cache_user_read" ON public.tts_audio_cache
  FOR SELECT
  USING (
    auth.uid() = created_by 
    OR auth.uid() = user_id
    OR preschool_id IN (
      SELECT preschool_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Users can insert cache entries
CREATE POLICY "tts_cache_user_insert" ON public.tts_audio_cache
  FOR INSERT
  WITH CHECK (auth.uid() = created_by OR auth.uid() = user_id);

-- Service role has full access (for Edge Functions)
CREATE POLICY "tts_cache_service_role" ON public.tts_audio_cache
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Voice Usage Logs policies
-- Users can read their own logs
CREATE POLICY "voice_logs_user_read" ON public.voice_usage_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can do everything (for Edge Functions)
CREATE POLICY "voice_logs_service_role" ON public.voice_usage_logs
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- ==== Comments ====
COMMENT ON TABLE public.tts_audio_cache IS 'Caches TTS audio to reduce API costs and latency';
COMMENT ON TABLE public.voice_usage_logs IS 'Tracks TTS/STT usage for cost monitoring and quota enforcement';
COMMENT ON COLUMN public.tts_audio_cache.preschool_id IS 'Optional - can be null for parent users without preschool';
COMMENT ON COLUMN public.voice_usage_logs.preschool_id IS 'Optional - can be null for parent users without preschool';
