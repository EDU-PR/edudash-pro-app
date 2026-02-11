-- ============================================================================
-- Migration: Secure debug_get_profile_direct RLS bypass
-- P0 CRITICAL: This function was callable by any authenticated user to read
-- ANY other user's profile row, bypassing RLS entirely.
-- Fix: Restrict to own profile only (auth.uid() must match target_auth_id).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.debug_get_profile_direct(target_auth_id uuid)
RETURNS SETOF profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security = off
AS $$
BEGIN
  -- Only allow users to query their own profile
  IF auth.uid() IS NULL OR auth.uid() != target_auth_id THEN
    RAISE EXCEPTION 'Unauthorized: can only access own profile';
  END IF;

  RETURN QUERY
    SELECT * FROM profiles
    WHERE auth_user_id = target_auth_id
    LIMIT 1;
END;
$$;

-- Restrict permissions
REVOKE ALL ON FUNCTION public.debug_get_profile_direct(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debug_get_profile_direct(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.debug_get_profile_direct(uuid) TO service_role;
