-- Migration: Fix region_invite_codes RLS policy roles
-- Problem: The "Anyone can read active codes" policy had no roles assigned ({-})
-- causing 406 errors for anonymous users.
-- Solution: Recreate with proper TO authenticated, anon clause.

-- Drop existing policy
DROP POLICY IF EXISTS "Anyone can read active codes" ON region_invite_codes;

-- Recreate with proper roles
CREATE POLICY "Anyone can read active codes"
ON region_invite_codes
FOR SELECT
TO authenticated, anon
USING (is_active = true);

COMMENT ON POLICY "Anyone can read active codes" ON region_invite_codes IS 
  'Allows anyone to validate active invite codes during registration.';
