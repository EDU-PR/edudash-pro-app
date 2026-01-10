-- Comprehensive fix for organization_documents RLS infinite recursion
-- Date: 2026-01-10
-- Issue: Both INSERT/ALL and SELECT policies have circular references

-- Temporarily disable RLS to work on policies
ALTER TABLE organization_documents DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS admins_manage_documents ON organization_documents;
DROP POLICY IF EXISTS members_view_documents ON organization_documents;

-- Recreate admins policy (INSERT/UPDATE/DELETE)
-- Simplified to avoid recursion - just check organization_members directly
CREATE POLICY admins_manage_documents ON organization_documents
FOR ALL
TO authenticated
USING (
  -- For SELECT/UPDATE/DELETE: check if user is an admin/executive in this org
  organization_id IN (
    SELECT om.organization_id
    FROM organization_members om
    WHERE om.user_id = auth.uid()
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
  )
)
WITH CHECK (
  -- For INSERT: check if user is an admin/executive in the target org
  organization_id IN (
    SELECT om.organization_id
    FROM organization_members om
    WHERE om.user_id = auth.uid()
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
  )
);

-- Recreate members view policy (SELECT only)
-- Simplified to avoid recursion
CREATE POLICY members_view_documents ON organization_documents
FOR SELECT
TO authenticated
USING (
  is_deleted = false
  AND (
    -- Public documents
    access_level = 'public'
    OR
    -- Check membership and access level
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.membership_status = 'active'
        AND (
          -- Members level
          (access_level = 'members')
          OR
          -- Managers level
          (access_level = 'managers' AND (
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
          (access_level = 'executives' AND (
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
          (access_level = 'admin_only' AND (
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
    )
    OR
    -- Custom access grants
    id IN (
      SELECT oda.document_id
      FROM organization_document_access oda
      WHERE oda.grantee_user_id = auth.uid()
        AND oda.revoked_at IS NULL
        AND (oda.valid_until IS NULL OR oda.valid_until > now())
    )
  )
);

-- Re-enable RLS
ALTER TABLE organization_documents ENABLE ROW LEVEL SECURITY;

-- Add helpful comments
COMMENT ON POLICY admins_manage_documents ON organization_documents IS 
'Allows executives and admins to manage documents. Uses IN subquery to avoid recursion.';

COMMENT ON POLICY members_view_documents ON organization_documents IS 
'Allows members to view documents based on access level. Uses IN subquery to avoid recursion.';
