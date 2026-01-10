-- Fix organization_documents RLS recursion using security definer function
-- Date: 2026-01-10
-- Approach: Use a security definer function to check permissions without triggering RLS

-- Drop existing policies
DROP POLICY IF EXISTS admins_manage_documents ON organization_documents;
DROP POLICY IF EXISTS members_view_documents ON organization_documents;

-- Create a security definer function to check if user can access org documents
CREATE OR REPLACE FUNCTION public.user_can_manage_org_documents(
  p_user_id UUID,
  p_org_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM organization_members om
    WHERE om.user_id = p_user_id
      AND om.organization_id = p_org_id
      AND om.membership_status = 'active'
      AND (
        om.role IN ('admin', 'national_admin')
        OR om.member_type IN (
          'ceo', 'president', 'deputy_president', 'secretary_general', 'treasurer',
          'national_admin', 'national_coordinator', 'executive', 'board_member',
          'youth_president', 'youth_deputy', 'youth_secretary', 'youth_treasurer',
          'women_president', 'women_deputy', 'women_secretary', 'women_treasurer',
          'veterans_president', 'regional_manager', 'regional_coordinator',
          'provincial_manager', 'provincial_coordinator', 'branch_manager'
        )
      )
  );
END;
$$;

-- Create function to check document view permissions
CREATE OR REPLACE FUNCTION public.user_can_view_org_document(
  p_user_id UUID,
  p_org_id UUID,
  p_access_level TEXT,
  p_document_id UUID,
  p_is_deleted BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Deleted documents are never visible
  IF p_is_deleted THEN
    RETURN FALSE;
  END IF;

  -- Public documents
  IF p_access_level = 'public' THEN
    RETURN TRUE;
  END IF;

  -- Check custom access grants
  IF EXISTS (
    SELECT 1
    FROM organization_document_access oda
    WHERE oda.document_id = p_document_id
      AND oda.grantee_user_id = p_user_id
      AND oda.revoked_at IS NULL
      AND (oda.valid_until IS NULL OR oda.valid_until > now())
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check organization membership and access level
  RETURN EXISTS (
    SELECT 1
    FROM organization_members om
    WHERE om.user_id = p_user_id
      AND om.organization_id = p_org_id
      AND om.membership_status = 'active'
      AND (
        -- Members level
        (p_access_level = 'members')
        OR
        -- Managers level
        (p_access_level = 'managers' AND (
          om.role IN ('admin', 'national_admin', 'regional_manager', 'branch_manager')
          OR om.member_type IN (
            'regional_manager', 'regional_coordinator', 'provincial_manager',
            'provincial_coordinator', 'branch_manager', 'ceo', 'president',
            'deputy_president', 'secretary_general', 'treasurer', 'national_admin',
            'national_coordinator', 'executive', 'board_member', 'youth_president',
            'youth_deputy', 'youth_secretary', 'youth_treasurer', 'women_president',
            'women_deputy', 'women_secretary', 'women_treasurer', 'veterans_president'
          )
        ))
        OR
        -- Executives level
        (p_access_level = 'executives' AND (
          om.role IN ('admin', 'national_admin')
          OR om.member_type IN (
            'ceo', 'president', 'deputy_president', 'secretary_general', 'treasurer',
            'national_admin', 'national_coordinator', 'executive', 'board_member',
            'youth_president', 'youth_deputy', 'youth_secretary', 'youth_treasurer',
            'women_president', 'women_deputy', 'women_secretary', 'women_treasurer',
            'veterans_president'
          )
        ))
        OR
        -- Admin only
        (p_access_level = 'admin_only' AND (
          om.role IN ('admin', 'national_admin')
          OR om.member_type IN (
            'ceo', 'president', 'deputy_president', 'secretary_general', 'treasurer',
            'national_admin', 'national_coordinator', 'executive', 'board_member',
            'youth_president', 'youth_deputy', 'youth_secretary', 'youth_treasurer',
            'women_president', 'women_deputy', 'women_secretary', 'women_treasurer',
            'veterans_president'
          )
        ))
      )
  );
END;
$$;

-- Create simple policies using the functions
CREATE POLICY admins_manage_documents ON organization_documents
FOR ALL
TO authenticated
USING (user_can_manage_org_documents(auth.uid(), organization_id))
WITH CHECK (user_can_manage_org_documents(auth.uid(), organization_id));

CREATE POLICY members_view_documents ON organization_documents
FOR SELECT
TO authenticated
USING (user_can_view_org_document(auth.uid(), organization_id, access_level, id, is_deleted));

-- Comments
COMMENT ON FUNCTION user_can_manage_org_documents IS 'Security definer function to check document management permissions without RLS recursion';
COMMENT ON FUNCTION user_can_view_org_document IS 'Security definer function to check document view permissions without RLS recursion';
