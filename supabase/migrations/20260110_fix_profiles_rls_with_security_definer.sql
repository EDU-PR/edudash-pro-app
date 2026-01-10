-- Fix profiles RLS to allow reading uploader information for documents
-- Uses security definer function to avoid infinite recursion

-- Drop existing problematic policy
DROP POLICY IF EXISTS "profiles_read_for_documents" ON public.profiles;

-- Create security definer function to check if user can read a profile
CREATE OR REPLACE FUNCTION user_can_read_profile(profile_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow users to read profiles of other users in their organization
  RETURN EXISTS (
    SELECT 1
    FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = profile_user_id
      AND om2.user_id = auth.uid()
      AND om1.seat_status = 'active'
      AND om2.seat_status = 'active'
  );
END;
$$;

-- Re-create policy using security definer function
CREATE POLICY "profiles_read_for_documents"
ON public.profiles
FOR SELECT
USING (user_can_read_profile(id));

-- Add comment
COMMENT ON FUNCTION user_can_read_profile IS
'Security definer function to check if user can read a profile without infinite recursion';

COMMENT ON POLICY "profiles_read_for_documents" ON public.profiles IS
'Allows users to read profiles of other users in their organization for document metadata';
