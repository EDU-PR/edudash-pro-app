-- Migration: Add missing columns for messaging overhaul
-- is_starred on messages, disappear_after_seconds on threads

-- ─── messages.is_starred ────────────────────────────────────────────
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_messages_starred
  ON public.messages (sender_id, is_starred)
  WHERE is_starred = TRUE;

-- ─── message_threads.disappear_after_seconds ─────────────────────
ALTER TABLE public.message_threads
  ADD COLUMN IF NOT EXISTS disappear_after_seconds INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.message_threads.disappear_after_seconds
  IS 'When set, messages in this thread auto-delete after N seconds. NULL = disabled.';

-- ─── Full-text search index on messages.content ──────────────────
-- Enables fast ILIKE / tsvector search for in-chat search feature
CREATE INDEX IF NOT EXISTS idx_messages_content_trgm
  ON public.messages USING gin (content gin_trgm_ops);

-- Enable pg_trgm if not already
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── RLS policies for new columns (inherit existing row policies) ─
-- No new policies needed — existing messages/threads RLS applies.

-- ─── Cron job: clean up expired disappearing messages ────────────
-- This uses pg_cron if available. Safe to skip if pg_cron is not enabled.
-- NOTE: Supabase Dashboard > Database > Extensions > pg_cron must be enabled first.
-- Then run manually in SQL editor:
--   SELECT cron.schedule(
--     'cleanup_disappearing_messages',
--     '*/5 * * * *',
--     $cron$
--       DELETE FROM public.messages m
--       USING public.message_threads t
--       WHERE m.thread_id = t.id
--         AND t.disappear_after_seconds IS NOT NULL
--         AND m.created_at < NOW() - (t.disappear_after_seconds || ' seconds')::INTERVAL;
--     $cron$
--   );
