-- Migration: Improve DELETE policies for messaging to allow participants to delete
-- This fixes the issue where only thread creators could delete conversations
-- Now any participant can delete threads they're part of

-- =============================================================================
-- Fix 1: Allow thread participants to delete message_threads (not just creator)
-- =============================================================================
DROP POLICY IF EXISTS "message_threads_delete_policy" ON public.message_threads;
CREATE POLICY "message_threads_delete_policy"
    ON public.message_threads FOR DELETE
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM message_participants mp
            WHERE mp.thread_id = message_threads.id
            AND mp.user_id = auth.uid()
        )
    );

COMMENT ON POLICY message_threads_delete_policy ON public.message_threads IS 
    'Allow thread creators or participants to delete threads';

-- =============================================================================
-- Fix 2: Allow participants to delete messages in their threads
-- =============================================================================
DROP POLICY IF EXISTS "messages_delete_policy" ON public.messages;
DROP POLICY IF EXISTS "messages_hard_delete_policy" ON public.messages;

CREATE POLICY "messages_delete_policy"
    ON public.messages FOR DELETE
    USING (
        -- Can delete own messages
        sender_id = auth.uid()
        -- Or any message in a thread you created
        OR EXISTS (
            SELECT 1 FROM message_threads mt
            WHERE mt.id = messages.thread_id
            AND mt.created_by = auth.uid()
        )
        -- Or any message in a thread you're a participant of (for clearing conversation)
        OR EXISTS (
            SELECT 1 FROM message_participants mp
            WHERE mp.thread_id = messages.thread_id
            AND mp.user_id = auth.uid()
        )
    );

COMMENT ON POLICY messages_delete_policy ON public.messages IS 
    'Allow users to delete their own messages or messages in threads they participate in';

-- =============================================================================
-- Fix 3: Allow participants to remove themselves from threads
-- =============================================================================
DROP POLICY IF EXISTS "message_participants_delete_policy" ON public.message_participants;

CREATE POLICY "message_participants_delete_policy"
    ON public.message_participants FOR DELETE
    USING (
        -- Can remove yourself
        user_id = auth.uid()
        -- Or remove others if you're the thread creator
        OR EXISTS (
            SELECT 1 FROM message_threads mt
            WHERE mt.id = message_participants.thread_id
            AND mt.created_by = auth.uid()
        )
    );

COMMENT ON POLICY message_participants_delete_policy ON public.message_participants IS 
    'Allow users to leave threads or creators to remove participants';

-- =============================================================================
-- Ensure grants are in place
-- =============================================================================
GRANT DELETE ON public.message_threads TO authenticated;
GRANT DELETE ON public.messages TO authenticated;
GRANT DELETE ON public.message_participants TO authenticated;
