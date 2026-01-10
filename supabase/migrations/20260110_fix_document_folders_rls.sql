-- Fix organization_document_folders and organization_documents RLS to use security definer functions
-- This prevents infinite recursion when these tables reference organization_members

-- We can reuse the existing security definer functions from organization_members fix
-- user_can_view_org_members(target_org_id UUID)
-- user_can_manage_org_members(target_org_id UUID)

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
