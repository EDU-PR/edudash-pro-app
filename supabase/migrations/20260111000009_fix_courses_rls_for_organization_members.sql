-- Fix courses table RLS policies to allow organization members (Youth President, Secretary, etc.) to create courses/programs
-- Date: 2026-01-11
-- Issue: Youth President/Secretary can't create programs because RLS policies don't allow organization members to insert courses

DO $$
DECLARE
  has_courses boolean;
  has_org_members boolean;
  has_membership_status boolean;
  has_org_id boolean;
  has_instructor_id boolean;
  has_is_active boolean;
  has_metadata boolean;
  membership_filter text := '';
BEGIN
  has_courses := to_regclass('public.courses') IS NOT NULL;
  has_org_members := to_regclass('public.organization_members') IS NOT NULL;

  IF NOT has_courses OR NOT has_org_members THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_members'
      AND column_name = 'membership_status'
  ) INTO has_membership_status;

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
      AND column_name = 'metadata'
  ) INTO has_metadata;

  IF NOT has_org_id OR NOT has_instructor_id THEN
    RETURN;
  END IF;

  IF has_membership_status THEN
    membership_filter := 'AND om.membership_status = ''active''';
  END IF;

  EXECUTE 'ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY';

  EXECUTE 'DROP POLICY IF EXISTS "courses_organization_members_insert" ON public.courses';
  EXECUTE 'DROP POLICY IF EXISTS "courses_organization_members_select" ON public.courses';
  EXECUTE 'DROP POLICY IF EXISTS "courses_organization_members_update" ON public.courses';
  EXECUTE 'DROP POLICY IF EXISTS "courses_organization_members_delete" ON public.courses';
  EXECUTE 'DROP POLICY IF EXISTS "courses_service_role" ON public.courses';

  EXECUTE $ddl$
    CREATE POLICY "courses_service_role"
    ON public.courses
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  $ddl$;

  EXECUTE format($func$
    CREATE OR REPLACE FUNCTION public.user_can_create_course(p_org_id UUID)
    RETURNS BOOLEAN
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, extensions, auth
    AS $body$
    BEGIN
      RETURN EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = p_org_id
          %s
          AND om.member_type IN (
            'youth_president',
            'youth_deputy',
            'youth_secretary',
            'youth_treasurer',
            'president',
            'deputy_president',
            'secretary_general',
            'treasurer'
          )
      );
    END;
    $body$;
  $func$, membership_filter);

  EXECUTE $ddl$
    CREATE POLICY "courses_organization_members_insert"
    ON public.courses
    FOR INSERT
    TO authenticated
    WITH CHECK (
      public.user_can_create_course(organization_id)
      AND instructor_id = auth.uid()
    );
  $ddl$;

  EXECUTE format($ddl$
    CREATE POLICY "courses_organization_members_select"
    ON public.courses
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = courses.organization_id
          %s
      )
      OR instructor_id = auth.uid()
      %s
    );
  $ddl$, membership_filter,
    CASE
      WHEN has_is_active AND has_metadata
        THEN 'OR (is_active = true AND (metadata->>''program_type'')::text = ''youth_program'')'
      ELSE ''
    END
  );

  EXECUTE format($ddl$
    CREATE POLICY "courses_organization_members_update"
    ON public.courses
    FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = courses.organization_id
          %s
          AND om.member_type IN (
            'youth_president',
            'youth_deputy',
            'youth_secretary',
            'youth_treasurer',
            'president',
            'deputy_president',
            'secretary_general',
            'treasurer'
          )
      )
      OR (instructor_id = auth.uid())
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = courses.organization_id
          %s
          AND om.member_type IN (
            'youth_president',
            'youth_deputy',
            'youth_secretary',
            'youth_treasurer',
            'president',
            'deputy_president',
            'secretary_general',
            'treasurer'
          )
      )
      OR (instructor_id = auth.uid())
    );
  $ddl$, membership_filter, membership_filter);

  EXECUTE format($ddl$
    CREATE POLICY "courses_organization_members_delete"
    ON public.courses
    FOR DELETE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = courses.organization_id
          %s
          AND om.member_type IN (
            'youth_president',
            'youth_deputy',
            'youth_secretary',
            'youth_treasurer',
            'president',
            'deputy_president',
            'secretary_general',
            'treasurer'
          )
      )
      OR (instructor_id = auth.uid())
    );
  $ddl$, membership_filter);

  EXECUTE 'COMMENT ON FUNCTION public.user_can_create_course(UUID) IS ''Security definer function to check if user can create courses for an organization. Returns true if user is an active organization member with executive privileges (youth_president, secretary, etc.)''';
  EXECUTE 'COMMENT ON POLICY "courses_organization_members_insert" ON public.courses IS ''Allows organization members (Youth President, Secretary, etc.) to create courses/programs for their organization''';
  EXECUTE 'COMMENT ON POLICY "courses_organization_members_select" ON public.courses IS ''Allows organization members to view courses/programs in their organization, or public youth programs''';
  EXECUTE 'COMMENT ON POLICY "courses_organization_members_update" ON public.courses IS ''Allows organization executives to update courses/programs in their organization, or instructors to update their own courses''';
  EXECUTE 'COMMENT ON POLICY "courses_organization_members_delete" ON public.courses IS ''Allows organization executives to delete courses/programs in their organization, or instructors to delete their own courses''';
END $$;
