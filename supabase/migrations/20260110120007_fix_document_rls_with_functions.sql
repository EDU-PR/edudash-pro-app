-- Fix organization_documents RLS recursion using security definer function
-- Date: 2026-01-10
-- Approach: Use a security definer function to check permissions without triggering RLS

-- Drop existing policies
DROP POLICY IF EXISTS admins_manage_documents ON organization_documents;
DROP POLICY IF EXISTS members_view_documents ON organization_documents;

DO $$
DECLARE
  has_membership_status boolean;
  has_seat_status boolean;
  has_access_table boolean;
  has_is_deleted boolean;
  membership_filter text := '';
  access_grant_block text := '';
  deleted_arg text := 'FALSE';
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
      AND table_name = 'organization_members'
      AND column_name = 'seat_status'
  ) INTO has_seat_status;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'organization_document_access'
  ) INTO has_access_table;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_documents'
      AND column_name = 'is_deleted'
  ) INTO has_is_deleted;

  IF has_membership_status THEN
    membership_filter := 'AND om.membership_status = ''active''';
  ELSIF has_seat_status THEN
    membership_filter := 'AND om.seat_status = ''active''';
  END IF;

  IF has_access_table THEN
    access_grant_block := $block$
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
$block$;
  END IF;

  IF has_is_deleted THEN
    deleted_arg := 'is_deleted';
  END IF;

  -- Create a security definer function to check if user can access org documents
  EXECUTE format($fn$
    CREATE OR REPLACE FUNCTION public.user_can_manage_org_documents(
      p_user_id UUID,
      p_org_id UUID
    )
    RETURNS BOOLEAN
    LANGUAGE plpgsql
    SECURITY DEFINER
    STABLE
    AS $func$
    BEGIN
      RETURN EXISTS (
        SELECT 1
        FROM organization_members om
        WHERE om.user_id = p_user_id
          AND om.organization_id = p_org_id
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
      );
    END;
    $func$;
  $fn$, membership_filter);

  -- Create function to check document view permissions
  EXECUTE format($fn$
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
    AS $func$
    BEGIN
      -- Deleted documents are never visible
      IF p_is_deleted THEN
        RETURN FALSE;
      END IF;

      -- Public documents
      IF p_access_level = 'public' THEN
        RETURN TRUE;
      END IF;
%s
      -- Check organization membership and access level
      RETURN EXISTS (
        SELECT 1
        FROM organization_members om
        WHERE om.user_id = p_user_id
          AND om.organization_id = p_org_id
          %s
          AND (
            (p_access_level = 'members')
            OR
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
    $func$;
  $fn$, access_grant_block, membership_filter);

  -- Create simple policies using the functions
  EXECUTE format($policy$
    CREATE POLICY admins_manage_documents ON organization_documents
    FOR ALL
    TO authenticated
    USING (user_can_manage_org_documents(auth.uid(), organization_id))
    WITH CHECK (user_can_manage_org_documents(auth.uid(), organization_id));
  $policy$);

  EXECUTE format($policy$
    CREATE POLICY members_view_documents ON organization_documents
    FOR SELECT
    TO authenticated
    USING (user_can_view_org_document(auth.uid(), organization_id, access_level, id, %s));
  $policy$, deleted_arg);
END
$$;

-- Comments
COMMENT ON FUNCTION user_can_manage_org_documents(UUID, UUID) IS
'Security definer function to check document management permissions without RLS recursion';

COMMENT ON FUNCTION user_can_view_org_document(UUID, UUID, TEXT, UUID, BOOLEAN) IS
'Security definer function to check document view permissions without RLS recursion';
