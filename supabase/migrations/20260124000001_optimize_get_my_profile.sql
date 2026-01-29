-- Optimize get_my_profile RPC performance

DO $sql$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users (auth_user_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_users_auth_user_id_active ON public.users (auth_user_id) WHERE is_active = true';

    EXECUTE $fn$
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
      AS $body$
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
      $body$;
    $fn$;

    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated';
  END IF;

  IF to_regclass('public.organization_members') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_organization_members_user_org ON public.organization_members (user_id, organization_id)';
  END IF;
END $sql$;
