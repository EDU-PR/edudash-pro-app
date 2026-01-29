-- Fix RLS policy for organization_documents INSERT issue
-- Date: 2026-01-11
-- Purpose: Fix 500 error on document insert by ensuring RLS policy works correctly for INSERTs
-- Issue: The WITH CHECK clause might be failing due to type casting or NULL handling

DO $$
DECLARE
  has_documents boolean;
  has_org_members boolean;
  has_membership_status boolean;
  membership_filter text := '';
BEGIN
  has_documents := to_regclass('public.organization_documents') IS NOT NULL;
  has_org_members := to_regclass('public.organization_members') IS NOT NULL;

  IF NOT has_documents OR NOT has_org_members THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_members'
      AND column_name = 'membership_status'
  ) INTO has_membership_status;

  IF has_membership_status THEN
    membership_filter := 'AND om.membership_status = ''active''';
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS admins_manage_documents ON organization_documents';

  EXECUTE format($ddl$
    CREATE POLICY admins_manage_documents ON organization_documents
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM organization_members om
          WHERE om.user_id = auth.uid()
            AND om.organization_id = organization_documents.organization_id
            %s
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
            AND om.organization_id = organization_documents.organization_id
            %s
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
  $ddl$, membership_filter, membership_filter);
END $$;
