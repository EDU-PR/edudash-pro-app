-- Backfill auth_user_id and add a safe principal/admin linkage RPC.
-- Rationale:
-- 1) RLS uses auth_user_id = auth.uid() for profile updates/organization lookups.
--    When auth_user_id is NULL, users (and principals) can get stuck.
-- 2) Principals/admins need a secure way to link parents/teachers to their school
--    without broad UPDATE policies on profiles.

-- 1) Backfill auth_user_id to match id where missing.
UPDATE public.profiles
SET auth_user_id = id
WHERE auth_user_id IS NULL;

-- 2) Secure linkage function for principals/admins/superadmins.
--    This bypasses RLS but enforces strong server-side checks.
CREATE OR REPLACE FUNCTION public.link_profile_to_school(
  p_target_profile_id uuid,
  p_school_id uuid,
  p_role text DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  actor_role text;
  actor_school_id uuid;
  actor_is_super boolean;
  updated_profile public.profiles;
BEGIN
  -- Resolve the acting user's role and school context.
  SELECT
    p.role,
    COALESCE(p.preschool_id, p.organization_id)
  INTO actor_role, actor_school_id
  FROM public.profiles p
  WHERE p.auth_user_id = auth.uid()
     OR p.id = auth.uid()
  LIMIT 1;

  IF actor_role IS NULL THEN
    RAISE EXCEPTION 'Actor profile not found';
  END IF;

  actor_is_super := actor_role IN ('superadmin', 'super_admin');

  -- Only principals/admins/superadmins can link other profiles.
  IF NOT actor_is_super AND actor_role NOT IN ('principal', 'principal_admin', 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions to link profiles';
  END IF;

  IF p_school_id IS NULL THEN
    RAISE EXCEPTION 'Target school is required';
  END IF;

  -- Non-super actors can only link within their own school.
  IF NOT actor_is_super THEN
    IF actor_school_id IS NULL THEN
      RAISE EXCEPTION 'Actor has no school context';
    END IF;
    IF actor_school_id <> p_school_id THEN
      RAISE EXCEPTION 'Cannot link profile to a different school';
    END IF;
  END IF;

  -- Perform the linkage.
  UPDATE public.profiles
  SET
    preschool_id = p_school_id,
    organization_id = p_school_id,
    role = COALESCE(p_role, role),
    auth_user_id = COALESCE(auth_user_id, id),
    updated_at = now()
  WHERE id = p_target_profile_id
     OR auth_user_id = p_target_profile_id
  RETURNING * INTO updated_profile;

  IF updated_profile.id IS NULL THEN
    RAISE EXCEPTION 'Target profile not found';
  END IF;

  RETURN updated_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_profile_to_school(uuid, uuid, text) TO authenticated;

