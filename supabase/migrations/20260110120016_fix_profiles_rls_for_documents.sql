-- Fix profiles RLS to allow reading uploader information for documents
-- This allows the organization_documents join to work properly

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "profiles_read_for_documents" ON public.profiles;

-- Create policy to allow reading profiles when joining with organization_documents
-- Users can read profiles of users in their organization
CREATE POLICY "profiles_read_for_documents"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_members om1
    WHERE om1.user_id = profiles.id
      AND om1.seat_status = 'active'
      AND EXISTS (
        SELECT 1
        FROM public.organization_members om2
        WHERE om2.user_id = auth.uid()
          AND om2.organization_id = om1.organization_id
          AND om2.seat_status = 'active'
      )
  )
);

-- Add comment
COMMENT ON POLICY "profiles_read_for_documents" ON public.profiles IS
'Allows users to read profiles of other users in their organization for document metadata';
