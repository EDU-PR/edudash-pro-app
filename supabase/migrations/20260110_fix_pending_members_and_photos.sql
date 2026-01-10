-- Fix pending members and profile picture loading issues
-- This migration addresses:
-- 1. Activate pending members who registered via web
-- 2. Sync profile avatars to organization_members.photo_url
-- 3. Create functions to manage member status

BEGIN;

-- ========================================
-- 1. ACTIVATE PENDING MEMBERS
-- ========================================
-- Members who registered via web have membership_status='pending'
-- but their seat_status is 'active'. Let's activate their membership.

UPDATE organization_members
SET 
  membership_status = 'active',
  updated_at = NOW()
WHERE organization_id = '63b6139a-e21f-447c-b322-376fb0828992'
  AND membership_status = 'pending'
  AND seat_status = 'active'
  AND join_date IS NOT NULL;

-- ========================================
-- 2. FIX PROFILE PICTURE SYNC
-- ========================================
-- The ID cards look for `organization_members.photo_url`
-- but avatars are stored in `profiles.avatar_url`
-- Let's sync them

UPDATE organization_members om
SET photo_url = p.avatar_url,
    updated_at = NOW()
FROM profiles p
WHERE om.user_id = p.id
  AND p.avatar_url IS NOT NULL
  AND (om.photo_url IS NULL OR om.photo_url != p.avatar_url);

-- ========================================
-- 3. CREATE FUNCTION: Activate Member
-- ========================================
-- Function to properly activate a pending member

CREATE OR REPLACE FUNCTION public.activate_organization_member(
  member_uuid UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  -- Update member to active status
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
$$;

COMMENT ON FUNCTION public.activate_organization_member(UUID) IS
'Activates a pending organization member. Sets both membership_status and seat_status to active.';

GRANT EXECUTE ON FUNCTION public.activate_organization_member(UUID) TO authenticated;

-- ========================================
-- 4. CREATE FUNCTION: Bulk Activate Members
-- ========================================
-- Function to activate multiple pending members at once

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
AS $$
DECLARE
  activated UUID[];
BEGIN
  -- Activate all pending members in the organization
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
$$;

COMMENT ON FUNCTION public.bulk_activate_organization_members(UUID) IS
'Activates all pending members in an organization. Returns count and IDs of activated members.';

GRANT EXECUTE ON FUNCTION public.bulk_activate_organization_members(UUID) TO authenticated;

-- ========================================
-- 5. CREATE TRIGGER: Auto-sync profile avatar
-- ========================================
-- Automatically sync profile.avatar_url to organization_members.photo_url

CREATE OR REPLACE FUNCTION public.sync_profile_avatar_to_org_members()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a profile avatar is updated, sync it to organization_members
  IF TG_OP = 'UPDATE' AND (NEW.avatar_url IS DISTINCT FROM OLD.avatar_url) THEN
    UPDATE organization_members
    SET photo_url = NEW.avatar_url,
        updated_at = NOW()
    WHERE user_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_sync_profile_avatar ON profiles;

-- Create the trigger
CREATE TRIGGER trigger_sync_profile_avatar
AFTER UPDATE ON profiles
FOR EACH ROW
WHEN (NEW.avatar_url IS DISTINCT FROM OLD.avatar_url)
EXECUTE FUNCTION sync_profile_avatar_to_org_members();

COMMENT ON TRIGGER trigger_sync_profile_avatar ON profiles IS
'Automatically syncs profile avatar_url changes to organization_members photo_url';

-- ========================================
-- 6. VERIFY CHANGES
-- ========================================

-- Count activated members
SELECT 
  COUNT(*) FILTER (WHERE membership_status = 'active') as active_members,
  COUNT(*) FILTER (WHERE membership_status = 'pending') as pending_members,
  COUNT(*) FILTER (WHERE photo_url IS NOT NULL) as members_with_photos
FROM organization_members
WHERE organization_id = '63b6139a-e21f-447c-b322-376fb0828992';

-- List recently activated members
SELECT 
  om.id,
  om.member_number,
  om.first_name || ' ' || om.last_name as name,
  om.email,
  om.member_type,
  om.membership_status,
  om.seat_status,
  om.photo_url IS NOT NULL as has_photo
FROM organization_members om
WHERE om.organization_id = '63b6139a-e21f-447c-b322-376fb0828992'
  AND om.join_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY om.join_date DESC
LIMIT 10;

COMMIT;
