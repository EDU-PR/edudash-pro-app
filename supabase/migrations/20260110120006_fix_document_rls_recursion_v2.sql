-- Comprehensive fix for organization_documents RLS infinite recursion
-- Date: 2026-01-10
-- Issue: Both INSERT/ALL and SELECT policies have circular references

-- Temporarily disable RLS to work on policies
ALTER TABLE organization_documents DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS admins_manage_documents ON organization_documents;
DROP POLICY IF EXISTS members_view_documents ON organization_documents;

-- Recreate policies with membership_status and is_deleted guards for older schemas
DO $$
DECLARE
  has_membership_status boolean;
  has_is_deleted boolean;
  has_access_table boolean;
  membership_filter text := '';
  deleted_filter text := 'TRUE';
  access_grant_clause text := 'FALSE';
BEGIN
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
      AND table_name = 'organization_documents'
      AND column_name = 'is_deleted'
  ) INTO has_is_deleted;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'organization_document_access'
  ) INTO has_access_table;

  IF has_membership_status THEN
    membership_filter := 'AND om.membership_status = ''active''';
  END IF;

  IF has_is_deleted THEN
    deleted_filter := 'is_deleted = false';
  END IF;

  IF has_access_table THEN
    access_grant_clause := $clause$
      id IN (
        SELECT oda.document_id
        FROM organization_document_access oda
        WHERE oda.grantee_user_id = auth.uid()
          AND oda.revoked_at IS NULL
          AND (oda.valid_until IS NULL OR oda.valid_until > now())
      )
    $clause$;
  END IF;

    EXECUTE format($policy$
    CREATE POLICY admins_manage_documents ON organization_documents
    FOR ALL
    TO authenticated
    USING (
      organization_id IN (
        SELECT om.organization_id
        FROM organization_members om
        WHERE om.user_id = auth.uid()
          %s
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
      organization_id IN (
        SELECT om.organization_id
        FROM organization_members om
        WHERE om.user_id = auth.uid()
          %s
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
  $policy$, membership_filter, membership_filter);

  EXECUTE format($policy$
    CREATE POLICY members_view_documents ON organization_documents
    FOR SELECT
    TO authenticated
    USING (
      %s
      AND (
        access_level = 'public'
        OR
        organization_id IN (
          SELECT om.organization_id
          FROM organization_members om
          WHERE om.user_id = auth.uid()
            %s
            AND (
              (access_level = 'members')
              OR
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
        %s
      )
    );
  $policy$, deleted_filter, membership_filter, access_grant_clause);
END
$$;

-- Re-enable RLS
ALTER TABLE organization_documents ENABLE ROW LEVEL SECURITY;

-- Add helpful comments
COMMENT ON POLICY admins_manage_documents ON organization_documents IS 
'Allows executives and admins to manage documents. Uses IN subquery to avoid recursion.';

COMMENT ON POLICY members_view_documents ON organization_documents IS 
'Allows members to view documents based on access level. Uses IN subquery to avoid recursion.';
