-- Fix guardian_requests RLS policies
-- The original policies incorrectly use profiles.id = auth.uid() 
-- but it should be profiles.auth_user_id = auth.uid()
-- auth.uid() returns the authenticated user's UUID from auth.users table
-- which matches auth_user_id in profiles, NOT the profile's id column

-- Drop the broken policies
DROP POLICY IF EXISTS "guardian_requests_school_select" ON guardian_requests;
DROP POLICY IF EXISTS "guardian_requests_school_modify" ON guardian_requests;

-- Recreate the SELECT policy with correct auth check
CREATE POLICY "guardian_requests_school_select" ON guardian_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = auth.uid()
        AND profiles.role IN ('teacher', 'principal', 'superadmin')
        AND (
          profiles.organization_id = guardian_requests.school_id 
          OR profiles.preschool_id = guardian_requests.school_id
        )
    )
  );

-- Recreate the ALL (modify) policy with correct auth check
CREATE POLICY "guardian_requests_school_modify" ON guardian_requests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = auth.uid()
        AND profiles.role IN ('teacher', 'principal', 'superadmin')
        AND (
          profiles.organization_id = guardian_requests.school_id 
          OR profiles.preschool_id = guardian_requests.school_id
        )
    )
  );

-- Add comment documenting the fix
COMMENT ON POLICY "guardian_requests_school_select" ON guardian_requests IS 'Staff can view guardian requests for their school. Fixed to use auth_user_id instead of id.';
COMMENT ON POLICY "guardian_requests_school_modify" ON guardian_requests IS 'Staff can manage guardian requests for their school. Fixed to use auth_user_id instead of id.';
