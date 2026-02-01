-- Fix superadmin AI control ownership persistence
-- 1) Backfill missing auth_user_id
-- 2) Allow superadmin checks to use auth_user_id OR id
-- 3) Ensure AI control singleton row exists
-- 4) Allow super admins to insert the singleton if needed

UPDATE public.profiles
SET auth_user_id = id
WHERE auth_user_id IS NULL;

CREATE OR REPLACE FUNCTION public.is_superadmin_safe()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM public.profiles
  WHERE auth_user_id = auth.uid() OR id = auth.uid();

  RETURN user_role IN ('superadmin', 'super_admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE (auth_user_id = auth.uid() OR id = auth.uid())
      AND role IN ('superadmin', 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.app_is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE (p.auth_user_id = auth.uid() OR p.id = auth.uid())
      AND p.role IN ('superadmin','super_admin')
  );
$$;

INSERT INTO public.superadmin_ai_control (id)
SELECT 1
WHERE NOT EXISTS (SELECT 1 FROM public.superadmin_ai_control WHERE id = 1);

DROP POLICY IF EXISTS superadmin_ai_control_insert ON public.superadmin_ai_control;
CREATE POLICY superadmin_ai_control_insert
  ON public.superadmin_ai_control
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    AND owner_user_id = auth.uid()
  );
