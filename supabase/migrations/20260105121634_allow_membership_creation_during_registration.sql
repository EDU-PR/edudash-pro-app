-- Allow membership creation during registration (before email confirmation)
-- This policy allows inserting a membership record when:
-- 1. The user_id exists in auth.users (user was just created via signUp)
-- 2. Either the user is authenticated OR the status is 'pending_verification'

CREATE POLICY "Allow membership creation during registration"
ON organization_members
FOR INSERT
WITH CHECK (
  -- The user_id must exist in auth.users (valid user was just created)
  EXISTS (SELECT 1 FROM auth.users WHERE id = organization_members.user_id)
  AND (
    -- Either the user is authenticated and inserting their own record
    (user_id = auth.uid())
    OR
    -- Or it's a pending_verification record (registration before email confirmation)
    (membership_status = 'pending_verification')
  )
);
