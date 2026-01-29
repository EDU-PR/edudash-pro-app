-- Add region_id to join_requests table for proper region routing
-- Date: 2026-01-11
-- Issue: Invite codes were defaulting to Eastern Cape (EC) because join_requests
--        didn't store which region the invite belongs to

DO $$
DECLARE
  has_join_requests boolean;
  has_org_regions boolean;
BEGIN
  has_join_requests := to_regclass('public.join_requests') IS NOT NULL;
  has_org_regions := to_regclass('public.organization_regions') IS NOT NULL;

  IF NOT has_join_requests THEN
    RETURN;
  END IF;

  IF has_org_regions THEN
    EXECUTE 'ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES organization_regions(id)';
  ELSE
    EXECUTE 'ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS region_id UUID';
  END IF;

  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_join_requests_region_id ON public.join_requests(region_id)';
  EXECUTE 'COMMENT ON COLUMN public.join_requests.region_id IS ''The region this invite is for. Set when invite is created to match the inviter''''s region.''';
END $$;
