-- ========================================================================== 
-- Migration: Fix guardian_requests_parent_insert RLS Policy
-- ==========================================================================

DO $sql$
DECLARE
  has_guardian_requests boolean := to_regclass('public.guardian_requests') IS NOT NULL;
  has_profiles boolean := to_regclass('public.profiles') IS NOT NULL;

  has_parent_auth_id boolean := false;
  has_status boolean := false;
  has_school_id boolean := false;

  has_profiles_auth_user_id boolean := false;
  has_profiles_role boolean := false;
  has_profiles_preschool_id boolean := false;

  base_cond text;
  status_cond text;
  school_cond text;
  policy_sql text;
BEGIN
  IF NOT has_guardian_requests THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'guardian_requests' AND column_name = 'parent_auth_id'
  ) INTO has_parent_auth_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'guardian_requests' AND column_name = 'status'
  ) INTO has_status;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'guardian_requests' AND column_name = 'school_id'
  ) INTO has_school_id;

  IF has_profiles THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'auth_user_id'
    ) INTO has_profiles_auth_user_id;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
    ) INTO has_profiles_role;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'preschool_id'
    ) INTO has_profiles_preschool_id;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS guardian_requests_parent_insert ON public.guardian_requests';

  IF NOT has_parent_auth_id THEN
    RETURN;
  END IF;

  base_cond := 'parent_auth_id = auth.uid()';
  status_cond := NULL;
  IF has_status THEN
    status_cond := 'status = ''pending''::text';
  END IF;

  school_cond := NULL;
  IF has_school_id THEN
    IF has_profiles AND has_profiles_auth_user_id AND has_profiles_preschool_id THEN
      school_cond := '(school_id IS NULL) OR (EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_user_id = auth.uid()' ||
        CASE WHEN has_profiles_role THEN ' AND p.role = ''parent''::text' ELSE '' END ||
        ' AND p.preschool_id = guardian_requests.school_id))';
    ELSE
      school_cond := '(school_id IS NULL)';
    END IF;
  END IF;

  policy_sql := 'CREATE POLICY guardian_requests_parent_insert ON public.guardian_requests FOR INSERT WITH CHECK (' || base_cond;
  IF status_cond IS NOT NULL THEN
    policy_sql := policy_sql || ' AND ' || status_cond;
  END IF;
  IF school_cond IS NOT NULL THEN
    policy_sql := policy_sql || ' AND (' || school_cond || ')';
  END IF;
  policy_sql := policy_sql || ')';

  EXECUTE policy_sql;
  EXECUTE 'COMMENT ON POLICY guardian_requests_parent_insert ON public.guardian_requests IS ''Allows parents to insert guardian requests. Fixed 2026-01-22 to use profiles.auth_user_id = auth.uid() instead of profiles.id = auth.uid().''';
END $sql$;
