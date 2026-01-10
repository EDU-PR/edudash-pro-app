-- Fix RLS policy for organization_document_folders to allow executive member types
-- Date: 2026-01-11
-- Purpose: Allow youth_secretary and other executive member types to create folders
-- Issue: admins_manage_folders policy only checks role='admin' or 'national_admin',
--        but executive members use member_type instead (e.g., youth_secretary)

-- Drop existing policy
DROP POLICY IF EXISTS admins_manage_folders ON organization_document_folders;

-- Create updated policy that checks both role and member_type
CREATE POLICY admins_manage_folders ON organization_document_folders
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = organization_document_folders.organization_id
        AND om.membership_status = 'active'
        AND (
          -- Allow admins (role-based)
          om.role = ANY (ARRAY['admin'::text, 'national_admin'::text])
          OR
          -- Allow executive member types (member_type-based)
          om.member_type IN (
            'ceo', 'president', 'deputy_president', 'secretary_general', 'treasurer',
            'national_admin', 'national_coordinator', 'executive', 'board_member',
            'youth_president', 'youth_deputy', 'youth_secretary', 'youth_treasurer',
            'women_president', 'women_deputy', 'women_secretary', 'women_treasurer',
            'veterans_president',
            'regional_manager', 'regional_coordinator', 'provincial_manager', 'provincial_coordinator',
            'branch_manager'
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = organization_document_folders.organization_id
        AND om.membership_status = 'active'
        AND (
          -- Allow admins (role-based)
          om.role = ANY (ARRAY['admin'::text, 'national_admin'::text])
          OR
          -- Allow executive member types (member_type-based)
          om.member_type IN (
            'ceo', 'president', 'deputy_president', 'secretary_general', 'treasurer',
            'national_admin', 'national_coordinator', 'executive', 'board_member',
            'youth_president', 'youth_deputy', 'youth_secretary', 'youth_treasurer',
            'women_president', 'women_deputy', 'women_secretary', 'women_treasurer',
            'veterans_president',
            'regional_manager', 'regional_coordinator', 'provincial_manager', 'provincial_coordinator',
            'branch_manager'
          )
        )
    )
  );

-- Also update the view policy to include executive member types
DROP POLICY IF EXISTS members_view_folders ON organization_document_folders;

CREATE POLICY members_view_folders ON organization_document_folders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = organization_document_folders.organization_id
        AND om.membership_status = 'active'
        AND (
          -- Public folders - everyone can see
          organization_document_folders.default_access_level = 'public'
          OR
          -- Members folders - all active members can see
          organization_document_folders.default_access_level = 'members'
          OR
          -- Managers folders - managers and executives can see
          (
            organization_document_folders.default_access_level = 'managers'
            AND (
              om.role = ANY (ARRAY['admin'::text, 'national_admin'::text, 'regional_manager'::text, 'branch_manager'::text])
              OR om.member_type IN (
                'regional_manager', 'regional_coordinator', 'provincial_manager', 'provincial_coordinator',
                'branch_manager', 'ceo', 'president', 'deputy_president', 'secretary_general', 'treasurer',
                'national_admin', 'national_coordinator', 'executive', 'board_member',
                'youth_president', 'youth_deputy', 'youth_secretary', 'youth_treasurer',
                'women_president', 'women_deputy', 'women_secretary', 'women_treasurer',
                'veterans_president'
              )
            )
          )
          OR
          -- Executives folders - executives can see
          (
            organization_document_folders.default_access_level = 'executives'
            AND (
              om.role = ANY (ARRAY['admin'::text, 'national_admin'::text])
              OR om.member_type IN (
                'ceo', 'president', 'deputy_president', 'secretary_general', 'treasurer',
                'national_admin', 'national_coordinator', 'executive', 'board_member',
                'youth_president', 'youth_deputy', 'youth_secretary', 'youth_treasurer',
                'women_president', 'women_deputy', 'women_secretary', 'women_treasurer',
                'veterans_president'
              )
            )
          )
          OR
          -- Admin only folders - admins and executives can see
          (
            organization_document_folders.default_access_level = 'admin_only'
            AND (
              om.role = ANY (ARRAY['admin'::text, 'national_admin'::text])
              OR om.member_type IN (
                'ceo', 'president', 'deputy_president', 'secretary_general', 'treasurer',
                'national_admin', 'national_coordinator', 'executive', 'board_member',
                'youth_president', 'youth_deputy', 'youth_secretary', 'youth_treasurer',
                'women_president', 'women_deputy', 'women_secretary', 'women_treasurer',
                'veterans_president'
              )
            )
          )
        )
    )
  );
