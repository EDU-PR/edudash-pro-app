-- Fix RLS policy WITH CHECK clause using ALTER POLICY
-- Date: 2026-01-11
-- Purpose: Fix WITH CHECK clause to correctly reference the inserted row's organization_id
-- Issue: The policy has om.organization_id = om.organization_id (always true)
--        Should be om.organization_id = organization_id (comparing to inserted row)

DO $$
DECLARE
  has_documents boolean;
  has_org_members boolean;
  has_membership_status boolean;
  policy_exists boolean;
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

  SELECT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'organization_documents'
      AND policyname = 'admins_manage_documents'
  ) INTO policy_exists;

  IF NOT policy_exists THEN
    RETURN;
  END IF;

  IF has_membership_status THEN
    membership_filter := 'AND om.membership_status = ''active''';
  END IF;

  EXECUTE format($ddl$
    ALTER POLICY admins_manage_documents ON organization_documents
      USING (
        EXISTS (
          SELECT 1
          FROM organization_members om
          WHERE om.user_id = auth.uid()
            AND om.organization_id = organization_documents.organization_id
            %s
            AND (
              (om.role IS NOT NULL AND om.role = ANY (ARRAY['admin'::text, 'national_admin'::text]))
              OR
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
            AND om.organization_id = organization_id
            %s
            AND (
              (om.role IS NOT NULL AND om.role = ANY (ARRAY['admin'::text, 'national_admin'::text]))
              OR
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
