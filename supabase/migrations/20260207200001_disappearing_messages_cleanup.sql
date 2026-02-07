-- Migration: Create server-side function and pg_cron job for disappearing messages
-- Safely cleans up expired messages based on thread's disappear_after_seconds setting

-- ─── Enable pg_cron extension ────────────────────────────────────
-- On Supabase, pg_cron runs in the 'postgres' database on the 'cron' schema.
-- CREATE EXTENSION is idempotent with IF NOT EXISTS.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- ─── Create the cleanup function ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_disappearing_messages()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.messages m
  USING public.message_threads t
  WHERE m.thread_id = t.id
    AND t.disappear_after_seconds IS NOT NULL
    AND m.created_at < NOW() - (t.disappear_after_seconds || ' seconds')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  IF deleted_count > 0 THEN
    RAISE NOTICE 'Cleaned up % disappearing messages', deleted_count;
  END IF;
  
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_disappearing_messages()
  IS 'Deletes messages that have exceeded their thread disappear_after_seconds TTL. Called by pg_cron every 5 minutes.';

-- ─── Schedule via pg_cron (if available) ─────────────────────────
-- pg_cron must be enabled in Supabase Dashboard > Database > Extensions
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Remove existing job if present
    PERFORM cron.unschedule('cleanup_disappearing_messages');
    
    -- Schedule every 5 minutes
    PERFORM cron.schedule(
      'cleanup_disappearing_messages',
      '*/5 * * * *',
      'SELECT public.cleanup_disappearing_messages()'
    );
    
    RAISE NOTICE 'pg_cron job scheduled: cleanup_disappearing_messages (every 5 min)';
  ELSE
    RAISE NOTICE 'pg_cron not available. Please enable it in Supabase Dashboard > Database > Extensions, then run:';
    RAISE NOTICE 'SELECT cron.schedule(''cleanup_disappearing_messages'', ''*/5 * * * *'', ''SELECT public.cleanup_disappearing_messages()'');';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule pg_cron job: %. Run manually after enabling pg_cron.', SQLERRM;
END;
$$;

-- ─── Also add forwarded_from_id and edited_at columns to messages ─
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS forwarded_from_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_forwarded
  ON public.messages (forwarded_from_id)
  WHERE forwarded_from_id IS NOT NULL;

COMMENT ON COLUMN public.messages.forwarded_from_id
  IS 'References the original message this was forwarded from';
COMMENT ON COLUMN public.messages.edited_at
  IS 'Timestamp of last edit; NULL if never edited';
