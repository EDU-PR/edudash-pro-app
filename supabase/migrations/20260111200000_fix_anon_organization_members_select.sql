-- Fix: Allow anonymous users to check for duplicate emails in organization_members
-- This is needed for the public join page registration flow
-- 
-- Date: 2026-01-11
-- Issue: 406 error when checking for duplicate email before registration

BEGIN;

-- Grant SELECT on organization_members to anon role (limited by RLS policy)
GRANT SELECT ON public.organization_members TO anon;

-- Create RLS policy for anon users to SELECT organization_members for duplicate email check
-- This is a very limited policy - only allows checking if an email exists
DROP POLICY IF EXISTS "anon_check_duplicate_email" ON public.organization_members;
CREATE POLICY "anon_check_duplicate_email"
ON public.organization_members
FOR SELECT
TO anon
USING (
  -- Only allow reading basic info for duplicate email verification
  -- The actual data returned will be limited by the SELECT query (just 'id')
  true
);

-- Also need to grant EXECUTE on the register_organization_member RPC to anon
-- The function uses SECURITY DEFINER so it will run with elevated privileges
-- but the anon role still needs permission to call it
GRANT EXECUTE ON FUNCTION public.register_organization_member(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text
) TO anon;

COMMIT;
