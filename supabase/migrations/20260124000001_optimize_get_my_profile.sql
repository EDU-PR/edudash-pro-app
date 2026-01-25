-- Optimize get_my_profile RPC performance
-- - Add supporting indexes
-- - Bypass RLS inside the SECURITY DEFINER function (still scoped to auth.uid)

-- Indexes to speed auth user lookups
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id_active ON public.users (auth_user_id) WHERE is_active = true;

-- Optional: speed up organization membership lookups used in profile resolution
CREATE INDEX IF NOT EXISTS idx_organization_members_user_org ON public.organization_members (user_id, organization_id);

-- Fast path: return the current user's profile without RLS overhead
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE (
  id uuid,
  auth_user_id uuid,
  email text,
  first_name text,
  last_name text,
  name text,
  role text,
  preschool_id uuid,
  organization_id uuid,
  avatar_url text,
  is_active boolean,
  phone text,
  last_login_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT 
    u.id,
    u.auth_user_id,
    u.email,
    u.first_name,
    u.last_name,
    u.name,
    u.role,
    u.preschool_id,
    u.organization_id,
    u.avatar_url,
    u.is_active,
    u.phone,
    u.last_login_at,
    u.created_at,
    u.updated_at
  FROM public.users u
  WHERE u.auth_user_id = auth.uid()
    AND u.is_active = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
