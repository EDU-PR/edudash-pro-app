-- Fix pending members and profile picture loading issues
-- This migration addresses:
-- 1. Activate pending members who registered via web
-- 2. Sync profile avatars to organization_members.photo_url
-- 3. Create functions to manage member status

DO $$
DECLARE
  has_members boolean;
  has_profiles boolean;
  has_membership_status boolean;
  has_seat_status boolean;
  has_join_date boolean;
  has_photo_url boolean;
  has_updated_at boolean;
  has_avatar_url boolean;
BEGIN
  has_members := to_regclass('public.organization_members') IS NOT NULL;
  has_profiles := to_regclass('public.profiles') IS NOT NULL;

  IF NOT has_members OR NOT has_profiles THEN
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
      AND table_name = 'organization_members'
      AND column_name = 'seat_status'
  ) INTO has_seat_status;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_members'
      AND column_name = 'join_date'
  ) INTO has_join_date;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_members'
      AND column_name = 'photo_url'
  ) INTO has_photo_url;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_members'
      AND column_name = 'updated_at'
  ) INTO has_updated_at;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'avatar_url'
  ) INTO has_avatar_url;

  IF NOT has_membership_status OR NOT has_seat_status OR NOT has_join_date OR NOT has_photo_url OR NOT has_updated_at OR NOT has_avatar_url THEN
    RETURN;
  END IF;

  EXECUTE $migration$
    -- 1. Activate pending members
    UPDATE organization_members
    SET
      membership_status = 'active',
      updated_at = NOW()
    WHERE organization_id = '63b6139a-e21f-447c-b322-376fb0828992'
      AND membership_status = 'pending'
      AND seat_status = 'active'
      AND join_date IS NOT NULL;

    -- 2. Sync profile avatars to org members
    UPDATE organization_members om
    SET photo_url = p.avatar_url,
        updated_at = NOW()
    FROM profiles p
    WHERE om.user_id = p.id
      AND p.avatar_url IS NOT NULL
      AND (om.photo_url IS NULL OR om.photo_url != p.avatar_url);

    -- 3. Create function: Activate member
    CREATE OR REPLACE FUNCTION public.activate_organization_member(
      member_uuid UUID
    )
    RETURNS BOOLEAN
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, extensions, auth
    AS $func$
    DECLARE
      affected_rows INTEGER;
    BEGIN
      UPDATE organization_members
      SET
        membership_status = 'active',
        seat_status = 'active',
        updated_at = NOW()
      WHERE id = member_uuid
        AND membership_status = 'pending';

      GET DIAGNOSTICS affected_rows = ROW_COUNT;

      IF affected_rows = 0 THEN
        RAISE NOTICE 'Member % not found or already active', member_uuid;
        RETURN FALSE;
      END IF;

      RAISE NOTICE 'Member % successfully activated', member_uuid;
      RETURN TRUE;
    END;
    $func$;

    COMMENT ON FUNCTION public.activate_organization_member(UUID) IS
    'Activates a pending organization member. Sets both membership_status and seat_status to active.';

    GRANT EXECUTE ON FUNCTION public.activate_organization_member(UUID) TO authenticated;

    -- 4. Create function: Bulk activate members
    CREATE OR REPLACE FUNCTION public.bulk_activate_organization_members(
      organization_uuid UUID
    )
    RETURNS TABLE(
      activated_count INTEGER,
      member_ids UUID[]
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, extensions, auth
    AS $func$
    DECLARE
      activated UUID[];
    BEGIN
      WITH updated AS (
        UPDATE organization_members
        SET
          membership_status = 'active',
          seat_status = 'active',
          updated_at = NOW()
        WHERE organization_id = organization_uuid
          AND membership_status = 'pending'
          AND join_date IS NOT NULL
        RETURNING id
      )
      SELECT ARRAY_AGG(id) INTO activated FROM updated;

      RETURN QUERY SELECT
        COALESCE(array_length(activated, 1), 0) as activated_count,
        COALESCE(activated, ARRAY[]::UUID[]) as member_ids;
    END;
    $func$;

    COMMENT ON FUNCTION public.bulk_activate_organization_members(UUID) IS
    'Activates all pending members in an organization. Returns count and IDs of activated members.';

    GRANT EXECUTE ON FUNCTION public.bulk_activate_organization_members(UUID) TO authenticated;

    -- 5. Create trigger: Auto-sync profile avatar
    CREATE OR REPLACE FUNCTION public.sync_profile_avatar_to_org_members()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $func$
    BEGIN
      IF TG_OP = 'UPDATE' AND (NEW.avatar_url IS DISTINCT FROM OLD.avatar_url) THEN
        UPDATE organization_members
        SET photo_url = NEW.avatar_url,
            updated_at = NOW()
        WHERE user_id = NEW.id;
      END IF;

      RETURN NEW;
    END;
    $func$;

    DROP TRIGGER IF EXISTS trigger_sync_profile_avatar ON profiles;

    CREATE TRIGGER trigger_sync_profile_avatar
    AFTER UPDATE ON profiles
    FOR EACH ROW
    WHEN (NEW.avatar_url IS DISTINCT FROM OLD.avatar_url)
    EXECUTE FUNCTION sync_profile_avatar_to_org_members();

    COMMENT ON TRIGGER trigger_sync_profile_avatar ON profiles IS
    'Automatically syncs profile avatar_url changes to organization_members photo_url';
  $migration$;
END $$;
