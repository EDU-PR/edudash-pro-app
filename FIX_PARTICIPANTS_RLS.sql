-- Fix infinite recursion in message_participants RLS policy
-- The SELECT policy was checking message_participants to see if user can see message_participants (circular!)

-- Drop problematic policies
DROP POLICY IF EXISTS message_participants_select_policy ON message_participants;
DROP POLICY IF EXISTS message_participants_insert_policy ON message_participants;

-- Create simplified policies without circular dependencies
-- Users can see their own participant records
CREATE POLICY message_participants_select_policy ON message_participants
FOR SELECT USING (
  user_id = auth.uid()
);

-- Users can insert participants when they created the thread or are already a participant
CREATE POLICY message_participants_insert_policy ON message_participants
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM message_threads AS mt
    WHERE
      mt.id = message_participants.thread_id
      AND mt.created_by = auth.uid()
  )
);

SELECT 'SUCCESS: Fixed message_participants RLS policies' AS status;
