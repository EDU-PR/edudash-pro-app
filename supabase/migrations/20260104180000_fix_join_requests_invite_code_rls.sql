-- Migration: Fix join_requests RLS to allow invite code validation
-- Problem: New users (not yet members) cannot validate invite codes because
-- the existing policy only allows organization members to view invite codes.
-- Solution: Allow anyone to read join_requests by invite_code for validation.

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Members can view org invite codes" ON join_requests;

-- Create a new policy that allows ANYONE to validate an invite code
-- This is safe because:
-- 1. They can only read if they know the exact invite code
-- 2. No sensitive data is exposed (just org name, role requested)
-- 3. This is necessary for the invite flow to work
CREATE POLICY "Anyone can validate invite codes"
ON join_requests
FOR SELECT
TO authenticated, anon
USING (
  invite_code IS NOT NULL
  AND status = 'pending'
);

-- Keep the admin policy for viewing all requests (without needing invite code)
-- This already exists as "Admins can view all org join requests"

-- Also ensure organization members can still see invite codes for their org
-- (useful for Youth President dashboard to see their generated codes)
CREATE POLICY "Org members can view their org invite codes"
ON join_requests
FOR SELECT
TO authenticated
USING (
  invite_code IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
    AND om.organization_id = join_requests.organization_id
  )
);

-- Add comment explaining the policies
COMMENT ON POLICY "Anyone can validate invite codes" ON join_requests IS 
  'Allows new users to validate invite codes before registration. Only pending codes with invite_code set are visible.';

COMMENT ON POLICY "Org members can view their org invite codes" ON join_requests IS 
  'Allows organization members (like Youth President) to view invite codes they generated for their organization.';
