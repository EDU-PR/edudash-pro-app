-- Migration: Fix courses RLS to allow learners to view programs
-- Date: 2026-01-17
-- Issue: Learners cannot see programs created by Youth President/Secretary because
--        the SELECT policy is too restrictive. Learners who are organization members
--        should see all active courses in their organization.

DO $$
DECLARE
  courses_exists BOOLEAN;
  org_members_exists BOOLEAN;
  enrollments_exists BOOLEAN;
  has_org_id BOOLEAN;
  has_instructor_id BOOLEAN;
  has_is_active BOOLEAN;
  has_deleted_at BOOLEAN;
  has_membership_status BOOLEAN;
  membership_filter TEXT := '';
  org_members_clause TEXT := '';
  enrollments_clause TEXT := '';
  instructor_clause TEXT := '';
  active_clause TEXT := '';
  policy_conditions TEXT := '';
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'courses'
  ) INTO courses_exists;

  IF NOT courses_exists THEN
    RAISE NOTICE 'Skipping courses RLS update: public.courses table not found';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'organization_members'
  ) INTO org_members_exists;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'enrollments'
  ) INTO enrollments_exists;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'courses'
      AND column_name = 'organization_id'
  ) INTO has_org_id;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'courses'
      AND column_name = 'instructor_id'
  ) INTO has_instructor_id;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'courses'
      AND column_name = 'is_active'
  ) INTO has_is_active;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'courses'
      AND column_name = 'deleted_at'
  ) INTO has_deleted_at;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_members'
      AND column_name = 'membership_status'
  ) INTO has_membership_status;

  IF org_members_exists AND has_org_id THEN
    IF has_membership_status THEN
      membership_filter := ' AND om.membership_status = ''active''';
    END IF;
    org_members_clause := format(
      'EXISTS (SELECT 1 FROM public.organization_members om WHERE om.user_id = auth.uid() AND om.organization_id = courses.organization_id%s)',
      membership_filter
    );
  END IF;

  IF enrollments_exists THEN
    enrollments_clause := 'EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = courses.id AND e.student_id = auth.uid() AND e.is_active = true)';
  END IF;

  IF has_instructor_id THEN
    instructor_clause := 'instructor_id = auth.uid()';
  END IF;

  IF has_is_active THEN
    active_clause := 'is_active = true';
    IF has_deleted_at THEN
      active_clause := 'is_active = true AND deleted_at IS NULL';
    END IF;
  ELSIF has_deleted_at THEN
    active_clause := 'deleted_at IS NULL';
  ELSE
    active_clause := 'true';
  END IF;

  policy_conditions := active_clause;
  IF org_members_clause <> '' THEN
    policy_conditions := policy_conditions || ' OR ' || org_members_clause;
  END IF;
  IF instructor_clause <> '' THEN
    policy_conditions := policy_conditions || ' OR ' || instructor_clause;
  END IF;
  IF enrollments_clause <> '' THEN
    policy_conditions := policy_conditions || ' OR ' || enrollments_clause;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS "courses_organization_members_select" ON public.courses';
  EXECUTE format(
    'CREATE POLICY "courses_organization_members_select" ON public.courses FOR SELECT TO authenticated USING (%s)',
    policy_conditions
  );

  EXECUTE 'DROP POLICY IF EXISTS "courses_public_browse" ON public.courses';
  EXECUTE format(
    'CREATE POLICY "courses_public_browse" ON public.courses FOR SELECT TO authenticated USING (%s)',
    active_clause
  );

  EXECUTE 'COMMENT ON POLICY "courses_organization_members_select" ON public.courses IS ''Allows all authenticated users to view active courses. Organization members see their org courses, enrolled students see their courses, and all active courses are browseable.''';
  EXECUTE 'COMMENT ON POLICY "courses_public_browse" ON public.courses IS ''Allows all authenticated users to browse active courses for discovery and enrollment.''';
END;
$$;
