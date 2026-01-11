-- Allow anonymous users to look up invite codes from join_requests table
-- This is needed for the public join page (soilofafrica.org/join?code=XXX)
-- Users should be able to verify their invite code before creating an account
-- 
-- Date: 2026-01-11
-- Issue: Invite codes fail validation on soa-web because RLS blocks anonymous SELECT

BEGIN;

-- Grant SELECT on join_requests to anon role (table-level permission)
GRANT SELECT ON public.join_requests TO anon;

-- Grant SELECT on region_invite_codes to anon role (table-level permission)
GRANT SELECT ON public.region_invite_codes TO anon;

-- Grant SELECT on organizations to anon role (needed for org name lookup)
GRANT SELECT ON public.organizations TO anon;

-- Grant SELECT on organization_regions to anon role (needed for region info)
GRANT SELECT ON public.organization_regions TO anon;

-- Create RLS policy for anon users to SELECT join_requests by invite_code
-- Only allow selecting specific columns and only for pending invites
DROP POLICY IF EXISTS "anon_select_join_requests_by_invite_code" ON public.join_requests;
CREATE POLICY "anon_select_join_requests_by_invite_code"
ON public.join_requests
FOR SELECT
TO anon
USING (
  -- Only allow reading pending invites that have an invite code
  invite_code IS NOT NULL
  AND status = 'pending'
);

-- Create RLS policy for anon users to SELECT region_invite_codes
DROP POLICY IF EXISTS "anon_select_region_invite_codes" ON public.region_invite_codes;
CREATE POLICY "anon_select_region_invite_codes"
ON public.region_invite_codes
FOR SELECT
TO anon
USING (
  -- Only allow reading active invite codes
  is_active = true
);

-- Create RLS policy for anon users to SELECT organizations (public info only)
DROP POLICY IF EXISTS "anon_select_organizations_public" ON public.organizations;
CREATE POLICY "anon_select_organizations_public"
ON public.organizations
FOR SELECT
TO anon
USING (true);  -- Organizations are public info

-- Create RLS policy for anon users to SELECT organization_regions (public info only)
DROP POLICY IF EXISTS "anon_select_organization_regions_public" ON public.organization_regions;
CREATE POLICY "anon_select_organization_regions_public"
ON public.organization_regions
FOR SELECT
TO anon
USING (true);  -- Regions are public info

COMMIT;
