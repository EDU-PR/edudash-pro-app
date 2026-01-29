-- Allow anonymous users to look up invite codes from join_requests table
-- This is needed for the public join page (soilofafrica.org/join?code=XXX)
-- Users should be able to verify their invite code before creating an account
-- 
-- Date: 2026-01-11
-- Issue: Invite codes fail validation on soa-web because RLS blocks anonymous SELECT

DO $$
DECLARE
  has_join_requests boolean;
  has_region_invite_codes boolean;
  has_organizations boolean;
  has_organization_regions boolean;
  has_join_invite_code boolean;
  has_join_status boolean;
  has_region_is_active boolean;
BEGIN
  has_join_requests := to_regclass('public.join_requests') IS NOT NULL;
  has_region_invite_codes := to_regclass('public.region_invite_codes') IS NOT NULL;
  has_organizations := to_regclass('public.organizations') IS NOT NULL;
  has_organization_regions := to_regclass('public.organization_regions') IS NOT NULL;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'join_requests'
      AND column_name = 'invite_code'
  ) INTO has_join_invite_code;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'join_requests'
      AND column_name = 'status'
  ) INTO has_join_status;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'region_invite_codes'
      AND column_name = 'is_active'
  ) INTO has_region_is_active;

  IF has_join_requests THEN
    EXECUTE 'GRANT SELECT ON public.join_requests TO anon';
  END IF;

  IF has_region_invite_codes THEN
    EXECUTE 'GRANT SELECT ON public.region_invite_codes TO anon';
  END IF;

  IF has_organizations THEN
    EXECUTE 'GRANT SELECT ON public.organizations TO anon';
  END IF;

  IF has_organization_regions THEN
    EXECUTE 'GRANT SELECT ON public.organization_regions TO anon';
  END IF;

  IF has_join_requests AND has_join_invite_code AND has_join_status THEN
    EXECUTE 'DROP POLICY IF EXISTS "anon_select_join_requests_by_invite_code" ON public.join_requests';
    EXECUTE $ddl$
      CREATE POLICY "anon_select_join_requests_by_invite_code"
      ON public.join_requests
      FOR SELECT
      TO anon
      USING (
        invite_code IS NOT NULL
        AND status = 'pending'
      );
    $ddl$;
  END IF;

  IF has_region_invite_codes AND has_region_is_active THEN
    EXECUTE 'DROP POLICY IF EXISTS "anon_select_region_invite_codes" ON public.region_invite_codes';
    EXECUTE $ddl$
      CREATE POLICY "anon_select_region_invite_codes"
      ON public.region_invite_codes
      FOR SELECT
      TO anon
      USING (
        is_active = true
      );
    $ddl$;
  END IF;

  IF has_organizations THEN
    EXECUTE 'DROP POLICY IF EXISTS "anon_select_organizations_public" ON public.organizations';
    EXECUTE $ddl$
      CREATE POLICY "anon_select_organizations_public"
      ON public.organizations
      FOR SELECT
      TO anon
      USING (true);
    $ddl$;
  END IF;

  IF has_organization_regions THEN
    EXECUTE 'DROP POLICY IF EXISTS "anon_select_organization_regions_public" ON public.organization_regions';
    EXECUTE $ddl$
      CREATE POLICY "anon_select_organization_regions_public"
      ON public.organization_regions
      FOR SELECT
      TO anon
      USING (true);
    $ddl$;
  END IF;
END $$;
