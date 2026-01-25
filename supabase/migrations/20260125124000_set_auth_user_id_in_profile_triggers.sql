-- Ensure new auth signups populate profiles.auth_user_id.
-- Without this, RLS policies that rely on auth_user_id = auth.uid() break.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  INSERT INTO public.profiles (id, auth_user_id, email, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'parent'),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    auth_user_id = COALESCE(public.profiles.auth_user_id, EXCLUDED.auth_user_id),
    role = COALESCE(EXCLUDED.role, public.profiles.role),
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to create profile in handle_new_user for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_profile_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  user_role text;
  user_first_name text;
  user_last_name text;
  user_phone text;
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'parent');
  user_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1));
  user_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
  user_phone := NEW.raw_user_meta_data->>'phone';

  INSERT INTO public.profiles (
    id,
    auth_user_id,
    email,
    role,
    first_name,
    last_name,
    phone,
    created_at,
    updated_at,
    last_login_at
  ) VALUES (
    NEW.id,
    NEW.id,
    NEW.email,
    user_role::text,
    user_first_name,
    user_last_name,
    user_phone,
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    auth_user_id = COALESCE(public.profiles.auth_user_id, EXCLUDED.auth_user_id),
    role = COALESCE(public.profiles.role, EXCLUDED.role),
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to create profile for new user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

