-- Migration: Add DELETE policy for active_calls and messages table improvements
-- This fixes the bug where users cannot clear their call history
-- Also adds DELETE policy for messages table for complete messaging functionality

-- =============================================================================
-- Fix 1: Add missing DELETE policy for active_calls
-- =============================================================================
-- Without this policy, users cannot delete call history due to RLS
-- The active_calls table has INSERT, SELECT, UPDATE but was missing DELETE

DROP POLICY IF EXISTS "Users can delete their calls" ON public.active_calls;
CREATE POLICY "Users can delete their calls"
    ON public.active_calls FOR DELETE
    USING (auth.uid() = caller_id OR auth.uid() = callee_id);

-- Grant DELETE permission to authenticated users
GRANT DELETE ON public.active_calls TO authenticated;

-- =============================================================================
-- Fix 2: Add DELETE policy for messages (for message deletion feature)
-- =============================================================================
-- Allow users to delete their own messages or messages in threads they created

DROP POLICY IF EXISTS "messages_hard_delete_policy" ON public.messages;
CREATE POLICY "messages_hard_delete_policy"
    ON public.messages FOR DELETE
    USING (
        sender_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM message_threads mt
            WHERE mt.id = messages.thread_id
            AND mt.created_by = auth.uid()
        )
    );

GRANT DELETE ON public.messages TO authenticated;

-- =============================================================================
-- Fix 3: Add DELETE policy for message_threads
-- =============================================================================
-- Allow users to delete threads they created

DROP POLICY IF EXISTS "message_threads_delete_policy" ON public.message_threads;
CREATE POLICY "message_threads_delete_policy"
    ON public.message_threads FOR DELETE
    USING (created_by = auth.uid());

GRANT DELETE ON public.message_threads TO authenticated;

-- =============================================================================
-- Fix 4: Add DELETE policy for message_participants (cascade cleanup)
-- =============================================================================
-- Allow users to leave/remove themselves from threads

DROP POLICY IF EXISTS "message_participants_delete_policy" ON public.message_participants;
CREATE POLICY "message_participants_delete_policy"
    ON public.message_participants FOR DELETE
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM message_threads mt
            WHERE mt.id = message_participants.thread_id
            AND mt.created_by = auth.uid()
        )
    );

GRANT DELETE ON public.message_participants TO authenticated;
