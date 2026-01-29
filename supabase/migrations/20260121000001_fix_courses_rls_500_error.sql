-- Migration: Fix courses RLS 500 error for learners
-- Date: 2026-01-21
-- Issue: Learners get 500 error when fetching courses because of RLS policy issues
-- Root cause: Possible circular reference or performance issue in RLS policies
-- Solution: Simplify policies and ensure proper access for authenticated users

DO $policies$
DECLARE
  courses_exists BOOLEAN;
  has_is_active BOOLEAN;
  has_deleted_at BOOLEAN;
  has_instructor_id BOOLEAN;
  has_org_id BOOLEAN;
  org_members_exists BOOLEAN;
  has_om_user_id BOOLEAN;
  has_om_org_id BOOLEAN;
  has_member_type BOOLEAN;
  has_membership_status BOOLEAN;
  membership_filter TEXT := '';
  org_members_clause TEXT := '';
  select_condition TEXT := '';
  modify_condition TEXT := '';
  created_select BOOLEAN := false;
  created_insert BOOLEAN := false;
  created_update BOOLEAN := false;
  created_delete BOOLEAN := false;
  created_service BOOLEAN := false;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'courses'
  ) INTO courses_exists;

  IF NOT courses_exists THEN
    RAISE NOTICE 'Skipping courses RLS update: public.courses table not found';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'courses' AND column_name = 'is_active'
  ) INTO has_is_active;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'courses' AND column_name = 'deleted_at'
  ) INTO has_deleted_at;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'courses' AND column_name = 'instructor_id'
  ) INTO has_instructor_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'courses' AND column_name = 'organization_id'
  ) INTO has_org_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organization_members'
  ) INTO org_members_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_members' AND column_name = 'user_id'
  ) INTO has_om_user_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_members' AND column_name = 'organization_id'
  ) INTO has_om_org_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_members' AND column_name = 'member_type'
  ) INTO has_member_type;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_members' AND column_name = 'membership_status'
  ) INTO has_membership_status;

  IF org_members_exists AND has_om_user_id AND has_om_org_id AND has_member_type AND has_org_id THEN
    IF has_membership_status THEN
      membership_filter := ' AND om.membership_status = ''active''';
    END IF;
    org_members_clause :=
      'EXISTS (SELECT 1 FROM public.organization_members om WHERE om.user_id = auth.uid() ' ||
      'AND om.organization_id = courses.organization_id' || membership_filter ||
      ' AND om.member_type IN (' ||
      '''youth_president'', ''youth_deputy'', ''youth_secretary'', ''youth_treasurer'',' ||
      '''president'', ''deputy_president'', ''secretary_general'', ''treasurer'',' ||
      '''ceo'', ''national_admin'', ''regional_manager'', ''regional_coordinator'',' ||
      '''women_president'', ''women_secretary'', ''veterans_president'', ''veterans_coordinator''' ||
      '))';
  END IF;

  -- Drop ALL existing policies on courses to start fresh
  EXECUTE 'DROP POLICY IF EXISTS \"courses_organization_members_insert\" ON public.courses';
  EXECUTE 'DROP POLICY IF EXISTS \"courses_organization_members_select\" ON public.courses';
  EXECUTE 'DROP POLICY IF EXISTS \"courses_organization_members_update\" ON public.courses';
  EXECUTE 'DROP POLICY IF EXISTS \"courses_organization_members_delete\" ON public.courses';
  EXECUTE 'DROP POLICY IF EXISTS \"courses_service_role\" ON public.courses';
  EXECUTE 'DROP POLICY IF EXISTS \"courses_public_browse\" ON public.courses';
  EXECUTE 'DROP POLICY IF EXISTS \"courses_authenticated_select\" ON public.courses';
  EXECUTE 'DROP POLICY IF EXISTS \"courses_admin_create\" ON public.courses';
  EXECUTE 'DROP POLICY IF EXISTS \"courses_admin_read\" ON public.courses';
  EXECUTE 'DROP POLICY IF EXISTS \"courses_enrolled_student_read\" ON public.courses';
  EXECUTE 'DROP POLICY IF EXISTS \"courses_instructor_create\" ON public.courses';
  EXECUTE 'DROP POLICY IF EXISTS \"courses_instructor_read\" ON public.courses';
  EXECUTE 'DROP POLICY IF EXISTS \"courses_organization_delete\" ON public.courses';
  EXECUTE 'DROP POLICY IF EXISTS \"courses_organization_insert\" ON public.courses';
  EXECUTE 'DROP POLICY IF EXISTS \"courses_organization_update\" ON public.courses';
  EXECUTE 'DROP POLICY IF EXISTS \"courses_owner_delete\" ON public.courses';
  EXECUTE 'DROP POLICY IF EXISTS \"courses_owner_update\" ON public.courses';
  EXECUTE 'DROP POLICY IF EXISTS \"courses_public_read\" ON public.courses';
  EXECUTE 'DROP POLICY IF EXISTS \"courses_super_admin_read\" ON public.courses';

  -- Ensure RLS is enabled
  EXECUTE 'ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY';

  -- POLICY 1: Service Role Full Access
  EXECUTE 'CREATE POLICY \"courses_service_role\" ON public.courses FOR ALL TO service_role USING (true) WITH CHECK (true)';
  created_service := true;

  -- POLICY 2: SELECT - All authenticated users can view active courses
  IF has_is_active OR has_deleted_at OR has_instructor_id THEN
    IF has_is_active THEN
      select_condition := 'is_active = true';
      IF has_deleted_at THEN
        select_condition := select_condition || ' AND deleted_at IS NULL';
      END IF;
    ELSIF has_deleted_at THEN
      select_condition := 'deleted_at IS NULL';
    END IF;

    IF has_instructor_id THEN
      IF select_condition <> '' THEN
        select_condition := select_condition || ' OR ';
      END IF;
      select_condition := select_condition || 'instructor_id = auth.uid()';
    END IF;

    EXECUTE 'CREATE POLICY \"courses_authenticated_select\" ON public.courses FOR SELECT TO authenticated USING (' || select_condition || ')';
    created_select := true;
  ELSE
    RAISE NOTICE 'Skipping courses_authenticated_select: required columns missing';
  END IF;

  -- POLICY 3/4/5: INSERT/UPDATE/DELETE
  modify_condition := '';
  IF has_instructor_id THEN
    modify_condition := 'instructor_id = auth.uid()';
  END IF;
  IF org_members_clause <> '' THEN
    IF modify_condition <> '' THEN
      modify_condition := modify_condition || ' OR ' || org_members_clause;
    ELSE
      modify_condition := org_members_clause;
    END IF;
  END IF;

  IF modify_condition <> '' THEN
    EXECUTE 'CREATE POLICY \"courses_organization_insert\" ON public.courses FOR INSERT TO authenticated WITH CHECK (' || modify_condition || ')';
    EXECUTE 'CREATE POLICY \"courses_organization_update\" ON public.courses FOR UPDATE TO authenticated USING (' || modify_condition || ') WITH CHECK (' || modify_condition || ')';
    EXECUTE 'CREATE POLICY \"courses_organization_delete\" ON public.courses FOR DELETE TO authenticated USING (' || modify_condition || ')';
    created_insert := true;
    created_update := true;
    created_delete := true;
  ELSE
    RAISE NOTICE 'Skipping courses insert/update/delete policies: no usable conditions';
  END IF;

  -- Comments
  IF created_service THEN
    EXECUTE 'COMMENT ON POLICY \"courses_service_role\" ON public.courses IS ''Service role has full access to courses table for backend operations.''';
  END IF;
  IF created_select THEN
    EXECUTE 'COMMENT ON POLICY \"courses_authenticated_select\" ON public.courses IS ''All authenticated users can view active courses. Instructors can see their own courses regardless of status. This enables learners to browse available programs.''';
  END IF;
  IF created_insert THEN
    EXECUTE 'COMMENT ON POLICY \"courses_organization_insert\" ON public.courses IS ''Organization executives can create courses. Users can also create courses where they are the instructor.''';
  END IF;
  IF created_update THEN
    EXECUTE 'COMMENT ON POLICY \"courses_organization_update\" ON public.courses IS ''Instructors and organization executives can update courses.''';
  END IF;
  IF created_delete THEN
    EXECUTE 'COMMENT ON POLICY \"courses_organization_delete\" ON public.courses IS ''Instructors and organization executives can delete courses.''';
  END IF;
END;
$policies$;
