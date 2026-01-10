-- Fix infinite recursion in organization_documents RLS policy
-- Date: 2026-01-10
-- Issue: WITH CHECK clause was comparing om.organization_id to itself instead of organization_documents.organization_id

-- Drop the problematic policy
DROP POLICY IF EXISTS admins_manage_documents ON organization_documents;

-- Recreate with correct logic
CREATE POLICY admins_manage_documents ON organization_documents
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = organization_documents.organization_id
      AND om.membership_status = 'active'
      AND (
        -- Check role
        (om.role IS NOT NULL AND om.role IN ('admin', 'national_admin'))
        OR
        -- Check member_type for executives
        (om.member_type IS NOT NULL AND om.member_type IN (
          'ceo', 'president', 'deputy_president', 'secretary_general', 'treasurer',
          'national_admin', 'national_coordinator', 'executive', 'board_member',
          'youth_president', 'youth_deputy', 'youth_secretary', 'youth_treasurer',
          'women_president', 'women_deputy', 'women_secretary', 'women_treasurer',
          'veterans_president', 'regional_manager', 'regional_coordinator',
          'provincial_manager', 'provincial_coordinator', 'branch_manager'
        ))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = organization_documents.organization_id  -- FIXED: was om.organization_id before
      AND om.membership_status = 'active'
      AND (
        -- Check role
        (om.role IS NOT NULL AND om.role IN ('admin', 'national_admin'))
        OR
        -- Check member_type for executives
        (om.member_type IS NOT NULL AND om.member_type IN (
          'ceo', 'president', 'deputy_president', 'secretary_general', 'treasurer',
          'national_admin', 'national_coordinator', 'executive', 'board_member',
          'youth_president', 'youth_deputy', 'youth_secretary', 'youth_treasurer',
          'women_president', 'women_deputy', 'women_secretary', 'women_treasurer',
          'veterans_president', 'regional_manager', 'regional_coordinator',
          'provincial_manager', 'provincial_coordinator', 'branch_manager'
        ))
      )
  )
);

-- Add comment
COMMENT ON POLICY admins_manage_documents ON organization_documents IS 
'Allows executives and admins to manage documents in their organization. Fixed infinite recursion issue.';
