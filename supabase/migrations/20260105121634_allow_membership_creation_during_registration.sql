-- Allow membership creation during registration (before email confirmation)
-- This policy allows inserting a membership record when:
-- 1. The user_id exists in auth.users (user was just created via signUp)
-- 2. The status is 'pending_verification' (registration before email confirmation)

-- Create a helper function that runs with elevated privileges to check auth.users
-- (anon role cannot directly query auth.users in RLS policy checks)
CREATE OR REPLACE FUNCTION public.user_exists_in_auth(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = check_user_id);
$$;

-- Grant execute to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.user_exists_in_auth(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.user_exists_in_auth(uuid) TO authenticated;

-- Create the policy using the helper function
CREATE POLICY "Allow membership creation during registration"
ON organization_members
FOR INSERT
WITH CHECK (
  membership_status = 'pending_verification'
  AND public.user_exists_in_auth(user_id)
);
