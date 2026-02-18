-- =============================================================================
-- Migration: Enable Supabase Realtime for messaging, calls, and notification tables
-- =============================================================================
-- Problem: The `messages` table (and related tables) were never added to the
-- `supabase_realtime` publication. This means ALL postgres_changes subscriptions
-- for these tables across the entire app (40+ locations) silently receive NO events.
-- This is the root cause of:
--   - Delivery ticks never updating (no UPDATE events for delivered_at)
--   - No realtime message notifications on recipient devices
--   - No realtime call signaling via active_calls
--   - No realtime announcement delivery
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add tables to the supabase_realtime publication (idempotent)
-- ---------------------------------------------------------------------------

-- messages: INSERT (new messages), UPDATE (delivered_at, read_by, edits, deletes)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
END $$;

-- message_threads: UPDATE (last_message_at, snippet changes)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'message_threads'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.message_threads;
    END IF;
END $$;

-- message_participants: UPDATE (unread_count, last_read_at)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'message_participants'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.message_participants;
    END IF;
END $$;

-- message_reactions: INSERT, DELETE (emoji reactions on messages)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'message_reactions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
    END IF;
END $$;

-- active_calls: INSERT (incoming call), UPDATE (answered/ended/missed)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'active_calls'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.active_calls;
    END IF;
END $$;

-- call_signals: INSERT (backup meeting URL delivery)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'call_signals'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;
    END IF;
END $$;

-- announcements: INSERT (new announcements)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'announcements'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
    END IF;
END $$;

-- notifications: INSERT, UPDATE (in-app notification system)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
END $$;

-- student_activity_feed: INSERT, UPDATE (activity feed for parents)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'student_activity_feed'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.student_activity_feed;
    END IF;
END $$;

-- activity_reactions: INSERT, DELETE (reactions on activities)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'activity_reactions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_reactions;
    END IF;
END $$;

-- activity_comments: INSERT (comments on activities)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'activity_comments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_comments;
    END IF;
END $$;

-- attendance: INSERT, UPDATE (attendance tracking)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'attendance'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
    END IF;
END $$;

-- student_fees: UPDATE (payment status changes)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'student_fees'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.student_fees;
    END IF;
END $$;

-- pop_uploads: INSERT, UPDATE (proof of payment uploads)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'pop_uploads'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.pop_uploads;
    END IF;
END $$;

-- aftercare_registrations: INSERT, DELETE (aftercare spots)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'aftercare_registrations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.aftercare_registrations;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Set REPLICA IDENTITY FULL on tables that need UPDATE payloads
-- ---------------------------------------------------------------------------
-- By default PostgreSQL only includes the primary key in UPDATE WAL events.
-- Supabase Realtime needs REPLICA IDENTITY FULL to include all columns in
-- the `payload.new` / `payload.old` objects for UPDATE events.
-- This is critical for:
--   - messages: delivered_at, read_by, edited_at, deleted_at changes
--   - message_participants: unread_count, last_read_at changes
--   - active_calls: status transitions (ringing -> connected -> ended)
--   - message_threads: last_message_at, snippet updates
-- ---------------------------------------------------------------------------

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.message_threads REPLICA IDENTITY FULL;
ALTER TABLE public.message_participants REPLICA IDENTITY FULL;
ALTER TABLE public.active_calls REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.student_fees REPLICA IDENTITY FULL;
ALTER TABLE public.pop_uploads REPLICA IDENTITY FULL;
ALTER TABLE public.attendance REPLICA IDENTITY FULL;

-- ---------------------------------------------------------------------------
-- 3. Verification query (informational, runs after migration)
-- ---------------------------------------------------------------------------
-- You can verify with:
--   SELECT schemaname, tablename
--   FROM pg_publication_tables
--   WHERE pubname = 'supabase_realtime'
--   ORDER BY tablename;
-- ---------------------------------------------------------------------------
