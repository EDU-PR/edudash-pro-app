-- Migration: Fix message_participants RLS policy
-- The existing policy has a self-referential subquery that causes 500 errors
-- Solution: Simplify to just check if user_id matches auth.uid()

-- Drop the problematic policy
DROP POLICY IF EXISTS message_participants_select_policy ON message_participants;

-- Create a simple, working policy
-- Users can see their own participations (which is all they need to query their threads)
CREATE POLICY message_participants_select_policy ON message_participants
FOR SELECT USING (
  user_id = auth.uid()
);

-- Also create a policy to see OTHER participants in threads they're already in
-- This uses a security definer function to avoid the self-reference issue
CREATE OR REPLACE FUNCTION public.user_is_thread_participant(p_thread_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.message_participants
    WHERE thread_id = p_thread_id
    AND user_id = auth.uid()
  );
$$;

-- Drop the simple policy and create a better one using the function
DROP POLICY IF EXISTS message_participants_select_policy ON message_participants;

CREATE POLICY message_participants_select_policy ON message_participants
FOR SELECT USING (
  user_id = auth.uid()
  OR public.user_is_thread_participant(thread_id)
);

-- Grant execute on the function
GRANT EXECUTE ON FUNCTION public.user_is_thread_participant TO authenticated;
