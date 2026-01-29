-- Fix guardian_requests RLS policies
-- The original policies incorrectly use profiles.id = auth.uid()
-- but it should be profiles.auth_user_id = auth.uid()
-- auth.uid() returns the authenticated user's UUID from auth.users table
-- which matches auth_user_id in profiles, NOT the profile's id column

DO $sql$
DECLARE
  has_profiles boolean := to_regclass('public.profiles') IS NOT NULL;
  has_guardian_requests boolean := to_regclass('public.guardian_requests') IS NOT NULL;

  has_auth_user_id boolean := false;
  has_profiles_role boolean := false;
  has_profiles_org_id boolean := false;
  has_profiles_preschool_id boolean := false;
  has_school_id boolean := false;

  user_match text;
  role_filter text;
  school_match text;
  policy_sql text;
BEGIN
  IF has_profiles THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'auth_user_id'
    ) INTO has_auth_user_id;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'role'
    ) INTO has_profiles_role;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'organization_id'
    ) INTO has_profiles_org_id;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'preschool_id'
    ) INTO has_profiles_preschool_id;
  END IF;

  IF has_guardian_requests THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'guardian_requests'
        AND column_name = 'school_id'
    ) INTO has_school_id;
  END IF;

  IF has_guardian_requests THEN
    EXECUTE 'DROP POLICY IF EXISTS \"guardian_requests_school_select\" ON public.guardian_requests';
    EXECUTE 'DROP POLICY IF EXISTS \"guardian_requests_school_modify\" ON public.guardian_requests';
  END IF;

  IF has_guardian_requests AND has_profiles AND has_school_id AND (has_profiles_org_id OR has_profiles_preschool_id) THEN
    user_match := CASE WHEN has_auth_user_id THEN 'profiles.auth_user_id = auth.uid()' ELSE 'profiles.id = auth.uid()' END;
    role_filter := '';

    IF has_profiles_role THEN
      role_filter := ' AND profiles.role IN (''teacher'', ''principal'', ''superadmin'')';
    END IF;

    IF has_profiles_org_id AND has_profiles_preschool_id THEN
      school_match := '(profiles.organization_id = guardian_requests.school_id OR profiles.preschool_id = guardian_requests.school_id)';
    ELSIF has_profiles_org_id THEN
      school_match := 'profiles.organization_id = guardian_requests.school_id';
    ELSE
      school_match := 'profiles.preschool_id = guardian_requests.school_id';
    END IF;

    policy_sql := format(
      'CREATE POLICY \"guardian_requests_school_select\" ON public.guardian_requests FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE %s%s AND %s))',
      user_match,
      role_filter,
      school_match
    );
    EXECUTE policy_sql;

    policy_sql := format(
      'CREATE POLICY \"guardian_requests_school_modify\" ON public.guardian_requests FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE %s%s AND %s))',
      user_match,
      role_filter,
      school_match
    );
    EXECUTE policy_sql;

    EXECUTE 'COMMENT ON POLICY \"guardian_requests_school_select\" ON public.guardian_requests IS ''Staff can view guardian requests for their school. Fixed to use auth_user_id instead of id.''';
    EXECUTE 'COMMENT ON POLICY \"guardian_requests_school_modify\" ON public.guardian_requests IS ''Staff can manage guardian requests for their school. Fixed to use auth_user_id instead of id.''';
  END IF;
END $sql$;
