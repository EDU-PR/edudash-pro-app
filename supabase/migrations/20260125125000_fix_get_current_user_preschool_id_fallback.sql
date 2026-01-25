-- Make get_current_user_preschool_id resilient to profiles without auth_user_id.
-- This helps RLS policies continue to work during transitional states.

CREATE OR REPLACE FUNCTION public.get_current_user_preschool_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
  SELECT COALESCE(p.preschool_id, p.organization_id)
  FROM public.profiles p
  WHERE p.auth_user_id = auth.uid()
     OR p.id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_current_user_preschool_id() TO authenticated;

