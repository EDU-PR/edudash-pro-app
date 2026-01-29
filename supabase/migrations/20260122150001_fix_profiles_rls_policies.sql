-- Migration: Fix profiles RLS policies using incorrect id = auth.uid()
-- Problem: These policies check profiles.id = auth.uid() but auth.uid() returns the
-- auth.users UUID which maps to profiles.auth_user_id, NOT profiles.id
-- Solution: Change all id = auth.uid() to auth_user_id = auth.uid()

DO $sql$
DECLARE
  has_profiles boolean := to_regclass('public.profiles') IS NOT NULL;
  has_auth_user_id boolean := false;
BEGIN
  IF NOT has_profiles THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'auth_user_id'
  ) INTO has_auth_user_id;

  IF NOT has_auth_user_id THEN
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS auth_user_id uuid;
  END IF;

  DROP POLICY IF EXISTS "profiles_preschool_access" ON public.profiles;
  DROP POLICY IF EXISTS "users_select_own_profile" ON public.profiles;
  DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;

  -- Helper function used by policies
  CREATE OR REPLACE FUNCTION public.get_current_user_preschool_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public', 'extensions', 'auth'
  AS $$
    SELECT COALESCE(p.preschool_id, p.organization_id)
    FROM public.profiles p
    WHERE p.auth_user_id = auth.uid()
    LIMIT 1;
  $$;

  -- Policy for users to access profiles in their preschool
  CREATE POLICY "profiles_preschool_access" ON public.profiles
  FOR SELECT
  USING (
    (auth_user_id = auth.uid())
    OR (preschool_id = public.get_current_user_preschool_id())
  );

  -- Policy for users to select their own profile
  CREATE POLICY "users_select_own_profile" ON public.profiles
  FOR SELECT
  USING (auth_user_id = auth.uid());

  -- Policy for users to update their own profile
  CREATE POLICY "users_update_own_profile" ON public.profiles
  FOR UPDATE
  USING (auth_user_id = auth.uid());

  COMMENT ON POLICY "profiles_preschool_access" ON public.profiles IS
    'Allow users to see their own profile and profiles in their preschool. Fixed to use auth_user_id.';
  COMMENT ON POLICY "users_select_own_profile" ON public.profiles IS
    'Allow users to select their own profile. Fixed to use auth_user_id.';
  COMMENT ON POLICY "users_update_own_profile" ON public.profiles IS
    'Allow users to update their own profile. Fixed to use auth_user_id.';
END $sql$;
