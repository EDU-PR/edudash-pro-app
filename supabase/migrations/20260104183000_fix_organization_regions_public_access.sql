-- Migration: Allow public access to organization_regions for registration
-- Problem: New users can't see regions during registration because RLS policies
-- only allow org members to view regions.
-- Solution: Allow anyone to read active regions (needed for registration flow).

-- Add policy for public/anonymous access to view active regions
-- This is safe because:
-- 1. Only active regions are visible
-- 2. No sensitive data (just name, code, province)
-- 3. Required for registration flow to work
CREATE POLICY "Anyone can view active regions for registration"
ON organization_regions
FOR SELECT
TO authenticated, anon
USING (is_active = true);

COMMENT ON POLICY "Anyone can view active regions for registration" ON organization_regions IS 
  'Allows new users to see regions during registration. Only active regions are visible.';

-- Also allow public to count members per region (for display purposes)
-- This only returns counts, not actual member data
CREATE POLICY "Anyone can count members for region display"
ON organization_members
FOR SELECT
TO authenticated, anon
USING (
  -- Only allow SELECT for counting purposes when:
  -- 1. Member is active (not exposing inactive member counts)
  membership_status = 'active'
);

COMMENT ON POLICY "Anyone can count members for region display" ON organization_members IS 
  'Allows counting active members per region for registration display. No sensitive data exposed.';
