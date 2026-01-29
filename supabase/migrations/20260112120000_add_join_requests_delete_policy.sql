-- Add DELETE policy for join_requests table
-- Allows users to delete invite codes they created
-- 
-- Issue: The delete button on the youth-invite-code screen doesn't work
-- because there's no RLS policy allowing DELETE on join_requests
--
-- Date: 2026-01-12

DO $$
DECLARE
  has_join_requests boolean;
  has_org_members boolean;
  has_invited_by boolean;
  has_invite_code boolean;
  has_org_id boolean;
  has_member_type boolean;
BEGIN
  has_join_requests := to_regclass('public.join_requests') IS NOT NULL;
  has_org_members := to_regclass('public.organization_members') IS NOT NULL;

  IF NOT has_join_requests THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'join_requests'
      AND column_name = 'invited_by'
  ) INTO has_invited_by;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'join_requests'
      AND column_name = 'invite_code'
  ) INTO has_invite_code;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'join_requests'
      AND column_name = 'organization_id'
  ) INTO has_org_id;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_members'
      AND column_name = 'member_type'
  ) INTO has_member_type;

  EXECUTE 'GRANT DELETE ON public.join_requests TO authenticated';

  IF has_invited_by AND has_invite_code THEN
    EXECUTE 'DROP POLICY IF EXISTS "users_delete_own_invite_codes" ON public.join_requests';
    EXECUTE $ddl$
      CREATE POLICY "users_delete_own_invite_codes"
      ON public.join_requests
      FOR DELETE
      TO authenticated
      USING (
        invited_by = auth.uid()
        AND invite_code IS NOT NULL
      );
    $ddl$;
  END IF;

  IF has_org_members AND has_member_type AND has_org_id AND has_invite_code THEN
    EXECUTE 'DROP POLICY IF EXISTS "org_admins_delete_invite_codes" ON public.join_requests';
    EXECUTE $ddl$
      CREATE POLICY "org_admins_delete_invite_codes"
      ON public.join_requests
      FOR DELETE
      TO authenticated
      USING (
        invite_code IS NOT NULL
        AND organization_id IN (
          SELECT organization_id
          FROM public.organization_members
          WHERE user_id = auth.uid()
            AND member_type IN (
              'youth_president',
              'youth_secretary',
              'regional_manager',
              'national_admin',
              'president',
              'ceo',
              'board_member'
            )
        )
      );
    $ddl$;
  END IF;
END $$;
