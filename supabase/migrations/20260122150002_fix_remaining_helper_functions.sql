-- Migration: Fix remaining helper functions using incorrect id = auth.uid()
-- This migration fixes all functions that query profiles table with WHERE id = auth.uid()
-- The correct pattern is WHERE auth_user_id = auth.uid()

DO $sql$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS auth_user_id uuid,
      ADD COLUMN IF NOT EXISTS email text,
      ADD COLUMN IF NOT EXISTS role text,
      ADD COLUMN IF NOT EXISTS preschool_id uuid,
      ADD COLUMN IF NOT EXISTS organization_id uuid,
      ADD COLUMN IF NOT EXISTS first_name text,
      ADD COLUMN IF NOT EXISTS last_name text;
  END IF;
END $sql$;

-- ============================================================================
-- 1. Fix get_user_preschool_id
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_preschool_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
  SELECT COALESCE(preschool_id, organization_id)
  FROM public.profiles
  WHERE auth_user_id = auth.uid()  -- FIXED
  LIMIT 1;
$$;

-- ============================================================================
-- 2. Fix get_user_org_id
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
  SELECT COALESCE(organization_id, preschool_id)
  FROM public.profiles
  WHERE auth_user_id = auth.uid()  -- FIXED
  LIMIT 1;
$$;

-- ============================================================================
-- 3. Fix get_user_role
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
  SELECT role
  FROM public.profiles
  WHERE auth_user_id = auth.uid()  -- FIXED
  LIMIT 1;
$$;

-- ============================================================================
-- 4. Fix get_current_user_role
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
  SELECT role
  FROM public.profiles
  WHERE auth_user_id = auth.uid()  -- FIXED
  LIMIT 1;
$$;

-- ============================================================================
-- 5. Fix get_current_user_profile
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS TABLE(
  id uuid,
  auth_user_id uuid,
  email text,
  role text,
  preschool_id uuid,
  organization_id uuid,
  first_name text,
  last_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
  SELECT 
    p.id,
    p.auth_user_id,
    p.email,
    p.role,
    p.preschool_id,
    p.organization_id,
    p.first_name,
    p.last_name
  FROM public.profiles p
  WHERE p.auth_user_id = auth.uid()  -- FIXED
  LIMIT 1;
$$;

-- ============================================================================
-- 6. Fix is_superadmin
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = auth.uid()  -- FIXED
    AND role IN ('superadmin', 'super_admin')
  );
$$;

-- ============================================================================
-- 7. Fix is_superadmin_safe
-- ============================================================================
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
  -- Direct query without triggering RLS (SECURITY DEFINER)
  SELECT role INTO user_role
  FROM public.profiles
  WHERE auth_user_id = auth.uid();  -- FIXED

  RETURN user_role IN ('superadmin', 'super_admin');
END;
$$;

-- ============================================================================
-- 8. Fix is_super_admin
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = auth.uid()  -- FIXED
    AND role IN ('superadmin', 'super_admin')
  );
$$;

-- ============================================================================
-- 9. Fix is_admin_level
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin_level()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = auth.uid()  -- FIXED
    AND role IN ('superadmin', 'super_admin', 'principal', 'principal_admin', 'admin', 'preschool_admin')
  );
$$;

-- ============================================================================
-- 10. Fix is_preschool_admin
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_preschool_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = auth.uid()  -- FIXED
    AND role IN ('principal', 'principal_admin', 'admin', 'preschool_admin')
  );
$$;

-- ============================================================================
-- 11. Fix is_instructor_level
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_instructor_level()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = auth.uid()  -- FIXED
    AND role IN ('teacher', 'instructor', 'coach')
  );
$$;

-- ============================================================================
-- 12. Fix user_can_read_profile
-- ============================================================================
CREATE OR REPLACE FUNCTION public.user_can_read_profile(profile_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
DECLARE
  current_user_profile RECORD;
  target_profile RECORD;
BEGIN
  -- Get current user's profile
  SELECT * INTO current_user_profile
  FROM public.profiles
  WHERE auth_user_id = auth.uid();  -- FIXED

  IF current_user_profile IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Superadmins can read any profile
  IF current_user_profile.role IN ('superadmin', 'super_admin') THEN
    RETURN TRUE;
  END IF;

  -- Can always read own profile
  IF current_user_profile.id = profile_user_id THEN
    RETURN TRUE;
  END IF;

  -- Get target profile
  SELECT * INTO target_profile
  FROM public.profiles
  WHERE id = profile_user_id;

  IF target_profile IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Can read profiles in same organization
  IF COALESCE(current_user_profile.organization_id, current_user_profile.preschool_id) = 
     COALESCE(target_profile.organization_id, target_profile.preschool_id) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- ============================================================================
-- 13. Fix log_activity
-- ============================================================================
CREATE OR REPLACE FUNCTION public.log_activity(
  p_action text,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
DECLARE
  v_user_id uuid;
  v_preschool_id uuid;
  v_activity_id uuid;
BEGIN
  -- Get current user info
  SELECT id, COALESCE(preschool_id, organization_id)
  INTO v_user_id, v_preschool_id
  FROM public.profiles
  WHERE auth_user_id = auth.uid();  -- FIXED

  -- Insert activity log
  INSERT INTO public.activity_logs (
    user_id,
    preschool_id,
    action,
    entity_type,
    entity_id,
    details
  )
  VALUES (
    v_user_id,
    v_preschool_id,
    p_action,
    p_entity_type,
    p_entity_id,
    p_details
  )
  RETURNING id INTO v_activity_id;

  RETURN v_activity_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail the main operation if logging fails
    RETURN NULL;
END;
$$;

-- ============================================================================
-- 14. Fix can_self_enroll_in_course
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_self_enroll_in_course(course_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
DECLARE
  v_course RECORD;
  v_user_profile RECORD;
BEGIN
  -- Get user profile
  SELECT * INTO v_user_profile
  FROM public.profiles
  WHERE auth_user_id = auth.uid();  -- FIXED

  IF v_user_profile IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Get course info
  SELECT * INTO v_course
  FROM public.courses
  WHERE id = course_id;

  IF v_course IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if self-enrollment is allowed
  RETURN v_course.allow_self_enroll = TRUE 
    AND v_course.is_published = TRUE;
END;
$$;

-- ============================================================================
-- Add comments
-- ============================================================================
COMMENT ON FUNCTION public.get_user_preschool_id IS 'Get current user preschool ID. Fixed to use auth_user_id.';
COMMENT ON FUNCTION public.is_superadmin_safe IS 'Safe superadmin check. Fixed to use auth_user_id.';
COMMENT ON FUNCTION public.user_can_read_profile IS 'Check if user can read a profile. Fixed to use auth_user_id.';
