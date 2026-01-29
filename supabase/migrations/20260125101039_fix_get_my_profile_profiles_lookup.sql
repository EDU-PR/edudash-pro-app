-- Ensure get_my_profile returns the authenticated user's profile even when
-- profiles.id is not the auth UID (use auth_user_id as primary lookup).
-- This prevents 406/PGRST116 responses that can wedge profile loading.

DO $sql$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS auth_user_id uuid,
      ADD COLUMN IF NOT EXISTS email text,
      ADD COLUMN IF NOT EXISTS first_name text,
      ADD COLUMN IF NOT EXISTS last_name text,
      ADD COLUMN IF NOT EXISTS full_name text,
      ADD COLUMN IF NOT EXISTS role text,
      ADD COLUMN IF NOT EXISTS preschool_id uuid,
      ADD COLUMN IF NOT EXISTS organization_id uuid,
      ADD COLUMN IF NOT EXISTS avatar_url text,
      ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS phone text,
      ADD COLUMN IF NOT EXISTS last_login_at timestamp with time zone,
      ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

    UPDATE public.profiles
    SET is_active = true
    WHERE is_active IS NULL;

    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.get_my_profile()
      RETURNS TABLE(
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
        last_login_at timestamp with time zone,
        created_at timestamp with time zone,
        updated_at timestamp with time zone
      )
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      SET row_security = off
      AS $body$
        SELECT
          p.id,
          p.auth_user_id,
          p.email,
          p.first_name,
          p.last_name,
          COALESCE(
            p.full_name,
            NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), '')
          ) AS name,
          p.role,
          p.preschool_id,
          p.organization_id,
          p.avatar_url,
          p.is_active,
          p.phone,
          p.last_login_at,
          p.created_at,
          p.updated_at
        FROM public.profiles AS p
        WHERE p.is_active = true
          AND (
            p.auth_user_id = auth.uid()
            OR p.id = auth.uid()
          )
        LIMIT 1;
      $body$;
    $fn$;

    GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
  END IF;
END $sql$;
