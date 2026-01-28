-- Fix organization_document_folders and organization_documents RLS to use security definer functions
-- This prevents infinite recursion when these tables reference organization_members

-- First, ensure the required security definer functions exist
-- Create user_can_view_org_document if it doesn't exist
CREATE OR REPLACE FUNCTION user_can_view_org_document(doc_id UUID, doc_access_level TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  doc_org_id UUID;
BEGIN
  -- Get the organization_id for this document
  SELECT organization_id INTO doc_org_id
  FROM organization_documents
  WHERE id = doc_id;
  
  -- Check if user is a member of the document's organization
  RETURN EXISTS (
    SELECT 1
    FROM organization_members
    WHERE user_id = auth.uid()
      AND organization_id = doc_org_id
      AND seat_status = 'active'
  );
END;
$$;

-- Create user_can_view_org_members if it doesn't exist (for folders)
CREATE OR REPLACE FUNCTION user_can_view_org_members(target_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the authenticated user is a member of the target organization
  RETURN EXISTS (
    SELECT 1
    FROM organization_members
    WHERE user_id = auth.uid()
      AND organization_id = target_org_id
      AND seat_status = 'active'
  );
END;
$$;

-- Create user_can_manage_org_members if it doesn't exist (for admin operations)
CREATE OR REPLACE FUNCTION user_can_manage_org_members(target_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the authenticated user has admin/executive roles in the target organization
  RETURN EXISTS (
    SELECT 1
    FROM organization_members
    WHERE user_id = auth.uid()
      AND organization_id = target_org_id
      AND seat_status = 'active'
      AND (
        member_type IN ('ceo', 'president', 'deputy_president', 'secretary_general', 'treasurer', 
                       'national_admin', 'national_coordinator', 'executive', 'board_member',
                       'youth_president', 'youth_deputy', 'youth_secretary', 'youth_treasurer',
                       'women_president', 'women_deputy', 'women_secretary',
                       'veterans_president')
        OR role IN ('admin', 'super_admin')
      )
  );
END;
$$;

-- Drop and recreate folder policies
DROP POLICY IF EXISTS "admins_manage_folders" ON public.organization_document_folders;
DROP POLICY IF EXISTS "members_view_folders" ON public.organization_document_folders;

CREATE POLICY "admins_manage_folders"
ON public.organization_document_folders
FOR ALL
USING (user_can_manage_org_members(organization_id))
WITH CHECK (user_can_manage_org_members(organization_id));

CREATE POLICY "members_view_folders"
ON public.organization_document_folders
FOR SELECT
USING (user_can_view_org_members(organization_id));

-- Drop and recreate document policies (use existing security definer functions)
DROP POLICY IF EXISTS "admins_manage_documents" ON public.organization_documents;
DROP POLICY IF EXISTS "members_view_documents" ON public.organization_documents;

CREATE POLICY "admins_manage_documents"
ON public.organization_documents
FOR ALL
USING (user_can_manage_org_members(organization_id))
WITH CHECK (user_can_manage_org_members(organization_id));

CREATE POLICY "members_view_documents"
ON public.organization_documents
FOR SELECT
USING (user_can_view_org_document(id, access_level));

-- Add comments
COMMENT ON POLICY "admins_manage_folders" ON public.organization_document_folders IS
'Allows admins and executives to manage document folders using security definer function';

COMMENT ON POLICY "members_view_folders" ON public.organization_document_folders IS
'Allows members to view document folders using security definer function';

COMMENT ON POLICY "admins_manage_documents" ON public.organization_documents IS
'Allows admins and executives to manage documents using security definer function';

COMMENT ON POLICY "members_view_documents" ON public.organization_documents IS
'Allows members to view documents based on access level using security definer function';
