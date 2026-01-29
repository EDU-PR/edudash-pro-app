-- Fix RLS policy for organization_document_folders to allow executive member types
-- Date: 2026-01-11
-- Purpose: Allow youth_secretary and other executive member types to create folders
-- Issue: admins_manage_folders policy only checks role='admin' or 'national_admin',
--        but executive members use member_type instead (e.g., youth_secretary)

DO $$
DECLARE
  has_folders boolean;
  has_org_members boolean;
  has_membership_status boolean;
  has_default_access_level boolean;
  membership_filter text := '';
BEGIN
  has_folders := to_regclass('public.organization_document_folders') IS NOT NULL;
  has_org_members := to_regclass('public.organization_members') IS NOT NULL;

  IF NOT has_folders OR NOT has_org_members THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_members'
      AND column_name = 'membership_status'
  ) INTO has_membership_status;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_document_folders'
      AND column_name = 'default_access_level'
  ) INTO has_default_access_level;

  IF NOT has_default_access_level THEN
    RETURN;
  END IF;

  IF has_membership_status THEN
    membership_filter := 'AND om.membership_status = ''active''';
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS admins_manage_folders ON organization_document_folders';
  EXECUTE 'DROP POLICY IF EXISTS members_view_folders ON organization_document_folders';

  EXECUTE format($ddl$
    CREATE POLICY admins_manage_folders ON organization_document_folders
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM organization_members om
          WHERE om.user_id = auth.uid()
            AND om.organization_id = organization_document_folders.organization_id
            %s
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
            %s
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
  $ddl$, membership_filter, membership_filter);

  EXECUTE format($ddl$
    CREATE POLICY members_view_folders ON organization_document_folders
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM organization_members om
          WHERE om.user_id = auth.uid()
            AND om.organization_id = organization_document_folders.organization_id
            %s
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
  $ddl$, membership_filter);
END $$;
