-- Migration: Fix helper functions using incorrect profiles.id = auth.uid()
-- Problem: These functions check profiles.id = auth.uid() but auth.uid() returns the
-- auth.users UUID which maps to profiles.auth_user_id, NOT profiles.id
-- Solution: Change all p.id = auth.uid() to p.auth_user_id = auth.uid()

DO $sql$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS auth_user_id uuid;
  END IF;
END $sql$;

-- ============================================================================
-- 1. Fix user_can_manage_classes
-- ============================================================================
CREATE OR REPLACE FUNCTION public.user_can_manage_classes(preschool_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.auth_user_id = auth.uid()  -- FIXED: was p.id = auth.uid()
      AND (
        COALESCE(p.preschool_id, p.organization_id) = preschool_org_id
      )
      AND p.role IN ('principal', 'admin', 'principal_admin')
  );
END;
$$;

-- ============================================================================
-- 2. Fix user_can_view_classes
-- ============================================================================
CREATE OR REPLACE FUNCTION public.user_can_view_classes(
  preschool_org_id uuid,
  class_teacher_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
DECLARE
  user_preschool_id UUID;
  user_org_id UUID;
BEGIN
  -- Get user's preschool_id and organization_id
  SELECT p.preschool_id, p.organization_id
  INTO user_preschool_id, user_org_id
  FROM public.profiles p
  WHERE p.auth_user_id = auth.uid();  -- FIXED: was p.id = auth.uid()

  -- If user is the teacher of the class (teacher_id might be profile.id or auth_user_id)
  -- Check both possibilities for backward compatibility
  IF class_teacher_id = auth.uid() THEN
    RETURN TRUE;
  END IF;

  -- Also check if teacher_id matches user's profile id
  IF EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.auth_user_id = auth.uid() AND p.id = class_teacher_id
  ) THEN
    RETURN TRUE;
  END IF;

  -- If user belongs to the same preschool/organization
  IF COALESCE(user_preschool_id, user_org_id) = preschool_org_id THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- ============================================================================
-- 3. Fix app_is_super_admin
-- ============================================================================
CREATE OR REPLACE FUNCTION public.app_is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.auth_user_id = auth.uid()  -- FIXED: was p.id = auth.uid()
    AND p.role IN ('superadmin','super_admin')
  );
$$;

-- ============================================================================
-- 4. Fix get_user_organization_id
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
  SELECT
    COALESCE(
      p.organization_id,
      p.preschool_id
    ) as organization_id
  FROM profiles p
  WHERE p.auth_user_id = auth.uid();  -- FIXED: was p.id = auth.uid()
$$;

-- ============================================================================
-- 5. Fix is_org_admin
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.auth_user_id = auth.uid()  -- FIXED: was p.id = auth.uid()
    AND p.preschool_id = org_id
    AND p.role IN ('principal_admin', 'principal', 'admin')
  );
$$;

-- ============================================================================
-- 6. Fix same_organization_as_user
-- ============================================================================
CREATE OR REPLACE FUNCTION public.same_organization_as_user(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p1, profiles p2
    WHERE p1.auth_user_id = auth.uid()  -- FIXED: was p1.id = auth.uid()
    AND p2.id = target_user_id
    AND COALESCE(p1.organization_id, p1.preschool_id) = COALESCE(p2.organization_id, p2.preschool_id)
  );
$$;

-- ============================================================================
-- 7. Fix user_has_role
-- ============================================================================
CREATE OR REPLACE FUNCTION public.user_has_role(required_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.auth_user_id = auth.uid()  -- FIXED: was p.id = auth.uid()
    AND p.role = required_role
  );
$$;

-- ============================================================================
-- 8. Fix user_has_any_role
-- ============================================================================
CREATE OR REPLACE FUNCTION public.user_has_any_role(roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.auth_user_id = auth.uid()  -- FIXED: was p.id = auth.uid()
    AND p.role = ANY(roles)
  );
$$;

-- ============================================================================
-- 9. Fix util_caller_school
-- ============================================================================
CREATE OR REPLACE FUNCTION public.util_caller_school()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
  SELECT p.preschool_id
  FROM public.profiles p
  WHERE p.auth_user_id = auth.uid();  -- FIXED: was p.id = auth.uid()
$$;

-- ============================================================================
-- 10. Fix util_caller_principal_school
-- ============================================================================
CREATE OR REPLACE FUNCTION public.util_caller_principal_school()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
  SELECT p.preschool_id
  FROM public.profiles p
  WHERE p.auth_user_id = auth.uid()  -- FIXED: was p.id = auth.uid()
  AND p.role = 'principal';
$$;

-- ============================================================================
-- 11. Fix admin_create_school_subscription
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_create_school_subscription(
  p_school_id uuid,
  p_plan_id text,
  p_billing_frequency text DEFAULT 'monthly',
  p_seats_total integer DEFAULT 1
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
DECLARE
  v_sub_id uuid;
  v_is_admin boolean;
  v_start timestamptz := now();
  v_end timestamptz;
BEGIN
  -- Require authenticated user; verify they are super admin or principal_admin
  SELECT EXISTS(
    SELECT 1 FROM public.profiles p
    WHERE p.auth_user_id = auth.uid()  -- FIXED: was p.id = auth.uid()
    AND p.role IN ('super_admin','superadmin','principal_admin')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_billing_frequency NOT IN ('monthly','annual') THEN
    RAISE EXCEPTION 'invalid billing_frequency';
  END IF;

  IF p_billing_frequency = 'annual' THEN
    v_end := (v_start + interval '1 year');
  ELSE
    v_end := (v_start + interval '1 month');
  END IF;

  INSERT INTO public.subscriptions (
    id, school_id, plan_id, status, owner_type, billing_frequency,
    start_date, end_date, next_billing_date, seats_total, seats_used, metadata
  ) VALUES (
    gen_random_uuid(), p_school_id, p_plan_id, 'active', 'school', p_billing_frequency,
    v_start, v_end, v_end, greatest(1, coalesce(p_seats_total, 1)), 0,
    jsonb_build_object('created_by', 'admin_rpc')
  ) RETURNING id INTO v_sub_id;

  -- Optional: set school subscription_tier to plan_id when applicable
  UPDATE public.preschools SET subscription_tier = p_plan_id WHERE id = p_school_id;

  RETURN v_sub_id;
END;
$$;

-- ============================================================================
-- Add helpful comment
-- ============================================================================
COMMENT ON FUNCTION public.user_can_manage_classes IS 
  'Check if current user can manage classes for a preschool/org. Fixed to use auth_user_id.';
COMMENT ON FUNCTION public.user_can_view_classes IS 
  'Check if current user can view classes for a preschool/org. Fixed to use auth_user_id.';
COMMENT ON FUNCTION public.app_is_super_admin IS 
  'Check if current user is a super admin. Fixed to use auth_user_id.';
COMMENT ON FUNCTION public.get_user_organization_id IS 
  'Get current user organization/preschool ID. Fixed to use auth_user_id.';
