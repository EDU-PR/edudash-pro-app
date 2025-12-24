-- ============================================
-- Create get_my_org_member RPC function
-- Date: 2025-12-23
-- Purpose: Fetch current user's organization membership details including member_type
-- ============================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.get_my_org_member(uuid);

-- Create the get_my_org_member function
-- Returns the current user's membership record for a specific organization
CREATE OR REPLACE FUNCTION public.get_my_org_member(p_org_id uuid)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  region_id uuid,
  user_id uuid,
  member_number text,
  member_type text,
  first_name text,
  last_name text,
  email text,
  phone text,
  membership_tier text,
  membership_status text,
  seat_status text,
  joined_date date,
  created_at timestamptz,
  invited_by uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Get the current authenticated user ID
  current_user_id := auth.uid();
  
  -- Return empty if no authenticated user
  IF current_user_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Return the user's membership for the specified organization
  RETURN QUERY
  SELECT 
    om.id,
    om.organization_id,
    om.region_id,
    om.user_id,
    om.member_number,
    om.member_type,
    om.first_name,
    om.last_name,
    om.email,
    om.phone,
    om.membership_tier,
    om.membership_status,
    COALESCE(om.membership_status, 'active')::text as seat_status,
    om.joined_date,
    om.created_at,
    om.created_by as invited_by
  FROM organization_members om
  WHERE om.organization_id = p_org_id
    AND (om.user_id = current_user_id OR om.profile_id = current_user_id)
  LIMIT 1;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_my_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_org_member(uuid) TO service_role;

-- Add comment
COMMENT ON FUNCTION public.get_my_org_member(uuid) IS 
'Returns the current authenticated user''s organization membership record for the specified organization.
Used by fetchEnhancedUserProfile to get member_type for routing decisions (CEO vs regular admin).';
