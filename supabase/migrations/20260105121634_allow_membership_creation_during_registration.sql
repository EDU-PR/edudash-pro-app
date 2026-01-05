-- Allow membership creation during registration (before email confirmation)
-- This policy allows the anon role to insert a membership record when:
-- 1. The status is 'pending_verification' (registration before email confirmation)
-- 2. The foreign key constraint ensures user_id exists in auth.users
--
-- Note: We use a simple anon-only policy because:
-- - The anon role cannot query auth.users directly in RLS policies
-- - The foreign key constraint on user_id ensures data integrity
-- - Authenticated users have their own policy for joining via invite codes

CREATE POLICY "Allow pending verification inserts"
ON organization_members
FOR INSERT
TO anon
WITH CHECK (
  (membership_status)::text = 'pending_verification'::text
);
