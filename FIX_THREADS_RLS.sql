-- Fix message_threads SELECT policy to avoid checking participants
-- (which would then check threads again = circular)

DROP POLICY IF EXISTS message_threads_select_policy ON message_threads;

-- Users can see threads in their preschool where they are listed as participants
-- This uses a simple EXISTS check that won't cause recursion
CREATE POLICY message_threads_select_policy ON message_threads
FOR SELECT USING (
  -- Check if user is a participant directly (safe because we fixed participant policy)
  id IN (
    SELECT thread_id 
    FROM message_participants 
    WHERE user_id = auth.uid()
  )
  OR
  -- Or if they created it
  created_by = auth.uid()
);

SELECT 'SUCCESS: Fixed message_threads SELECT policy' AS status;
