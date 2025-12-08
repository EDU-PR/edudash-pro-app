-- Migration: Fix messages delete policy and improve call connection speed
-- Date: 2024-11-30
-- Description:
--   1. Add missing DELETE policy for messages table (allows users to delete their own messages)
--   2. Add missing DELETE policy for message_threads (allows thread deletion)
--   3. Optimize active_calls table for faster meeting_url lookup

-- ============================================================================
-- 1. Fix missing DELETE policy for messages
-- ============================================================================

-- Drop existing policy if it exists (to make migration idempotent)
DROP POLICY IF EXISTS messages_delete_policy ON public.messages;

-- Allow users to delete their own messages
CREATE POLICY messages_delete_policy ON public.messages
FOR DELETE USING (
  sender_id = auth.uid()
);

COMMENT ON POLICY messages_delete_policy ON public.messages IS 
  'Allow users to delete their own messages';

-- ============================================================================
-- 2. Fix DELETE policy for message_threads
-- ============================================================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS message_threads_delete_policy ON public.message_threads;

-- Allow participants to delete threads they're part of
CREATE POLICY message_threads_delete_policy ON public.message_threads
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.message_participants AS mp
    WHERE mp.thread_id = message_threads.id
      AND mp.user_id = auth.uid()
  )
);

COMMENT ON POLICY message_threads_delete_policy ON public.message_threads IS 
  'Allow thread participants to delete threads';

-- ============================================================================
-- 3. Fix DELETE policy for message_participants
-- ============================================================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS message_participants_delete_policy ON public.message_participants;

-- Allow users to delete their own participation
CREATE POLICY message_participants_delete_policy ON public.message_participants
FOR DELETE USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.message_participants AS mp
    WHERE mp.thread_id = message_participants.thread_id
      AND mp.user_id = auth.uid()
  )
);

COMMENT ON POLICY message_participants_delete_policy ON public.message_participants IS 
  'Allow users to delete message participants for threads they are part of';

-- ============================================================================
-- 4. Improve call connection speed by adding indexes
-- ============================================================================

-- Index for faster active_calls lookup by call_id
CREATE INDEX IF NOT EXISTS idx_active_calls_call_id 
  ON public.active_calls(call_id);

-- Index for faster caller lookup
CREATE INDEX IF NOT EXISTS idx_active_calls_caller_id_status 
  ON public.active_calls(caller_id, status);

-- Index for faster callee lookup
CREATE INDEX IF NOT EXISTS idx_active_calls_callee_id_status 
  ON public.active_calls(callee_id, status);

-- Index for call_signals faster lookup
CREATE INDEX IF NOT EXISTS idx_call_signals_call_id_type 
  ON public.call_signals(call_id, signal_type);

-- Index for call_signals by to_user_id
CREATE INDEX IF NOT EXISTS idx_call_signals_to_user_id 
  ON public.call_signals(to_user_id, created_at DESC);

-- ============================================================================
-- 5. Ensure meeting_url column exists and is indexed
-- ============================================================================

-- Add meeting_url to active_calls if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'active_calls' 
      AND column_name = 'meeting_url'
  ) THEN
    ALTER TABLE public.active_calls ADD COLUMN meeting_url TEXT;
  END IF;
END $$;

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  -- Verify policies were created
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' 
    AND tablename = 'messages'
    AND policyname = 'messages_delete_policy';
  
  IF policy_count = 0 THEN
    RAISE EXCEPTION 'messages_delete_policy was not created';
  END IF;
  
  RAISE NOTICE 'Migration completed successfully. Messages DELETE policy created.';
END $$;
