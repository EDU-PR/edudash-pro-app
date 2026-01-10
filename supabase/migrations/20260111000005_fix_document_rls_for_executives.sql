-- Fix RLS policy for organization_documents to allow executive member types
-- Date: 2026-01-11
-- Purpose: Allow youth_secretary and other executive member types to upload/manage documents
-- Issue: admins_manage_documents policy only checks role='admin' or 'national_admin',
--        but executive members use member_type instead (e.g., youth_secretary)

-- Drop existing policies
DROP POLICY IF EXISTS admins_manage_documents ON organization_documents;
DROP POLICY IF EXISTS members_view_documents ON organization_documents;

-- Create updated manage policy that checks both role and member_type
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
        AND om.organization_id = organization_documents.organization_id
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

-- Create updated view policy that includes executive member types
CREATE POLICY members_view_documents ON organization_documents
  FOR SELECT
  TO authenticated
  USING (
    is_deleted = false
    AND (
      -- Public documents - everyone can see
      access_level = 'public'
      OR
      -- Check member access based on access_level
      EXISTS (
        SELECT 1
        FROM organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = organization_documents.organization_id
          AND om.membership_status = 'active'
          AND (
            -- Members level - all active members can see
            organization_documents.access_level = 'members'
            OR
            -- Managers level - managers and executives can see
            (
              organization_documents.access_level = 'managers'
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
            -- Executives level - executives can see
            (
              organization_documents.access_level = 'executives'
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
            -- Admin only level - admins and executives can see
            (
              organization_documents.access_level = 'admin_only'
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
      OR
      -- Check explicit access grants
      EXISTS (
        SELECT 1
        FROM organization_document_access oda
        WHERE oda.document_id = organization_documents.id
          AND oda.grantee_user_id = auth.uid()
          AND oda.revoked_at IS NULL
          AND (oda.valid_until IS NULL OR oda.valid_until > now())
      )
    )
  );
