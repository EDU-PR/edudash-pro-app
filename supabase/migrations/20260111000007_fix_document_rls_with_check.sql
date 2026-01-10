-- Fix RLS policy WITH CHECK clause for organization_documents INSERT
-- Date: 2026-01-11
-- Purpose: Fix WITH CHECK clause to reference columns directly (without table prefix)
-- Issue: In WITH CHECK clauses, column references should not use table prefix

-- Drop existing policy
DROP POLICY IF EXISTS admins_manage_documents ON organization_documents;

-- Create updated policy with direct column references in WITH CHECK
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
          (om.role IS NOT NULL AND om.role = ANY (ARRAY['admin'::text, 'national_admin'::text]))
          OR
          -- Allow executive member types (member_type-based)
          (om.member_type IS NOT NULL AND om.member_type::text IN (
            'ceo', 'president', 'deputy_president', 'secretary_general', 'treasurer',
            'national_admin', 'national_coordinator', 'executive', 'board_member',
            'youth_president', 'youth_deputy', 'youth_secretary', 'youth_treasurer',
            'women_president', 'women_deputy', 'women_secretary', 'women_treasurer',
            'veterans_president',
            'regional_manager', 'regional_coordinator', 'provincial_manager', 'provincial_coordinator',
            'branch_manager'
          ))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        -- In WITH CHECK, reference the column directly (not table.column)
        AND om.organization_id = organization_id
        AND om.membership_status = 'active'
        AND (
          -- Allow admins (role-based)
          (om.role IS NOT NULL AND om.role = ANY (ARRAY['admin'::text, 'national_admin'::text]))
          OR
          -- Allow executive member types (member_type-based)
          (om.member_type IS NOT NULL AND om.member_type::text IN (
            'ceo', 'president', 'deputy_president', 'secretary_general', 'treasurer',
            'national_admin', 'national_coordinator', 'executive', 'board_member',
            'youth_president', 'youth_deputy', 'youth_secretary', 'youth_treasurer',
            'women_president', 'women_deputy', 'women_secretary', 'women_treasurer',
            'veterans_president',
            'regional_manager', 'regional_coordinator', 'provincial_manager', 'provincial_coordinator',
            'branch_manager'
          ))
        )
    )
  );
