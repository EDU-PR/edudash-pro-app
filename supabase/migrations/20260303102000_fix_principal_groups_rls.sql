-- Fix principal_groups RLS so principals (and teachers) can create groups
-- even when their profile uses preschool_id instead of organization_id.
--
-- Previous policy only matched principal_groups.preschool_id against
-- profiles.organization_id, which blocked principals that only have
-- preschool_id populated. This migration widens the match to
-- COALESCE(organization_id, preschool_id) while keeping the role guard.

DO $do$
BEGIN
  IF to_regclass('public.principal_groups') IS NULL THEN
    RETURN;
  END IF;

  -- Replace modify policy
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'principal_groups'
      AND policyname = 'principal_groups_tenant_modify'
  ) THEN
    DROP POLICY "principal_groups_tenant_modify" ON public.principal_groups;
  END IF;

  CREATE POLICY "principal_groups_tenant_modify"
  ON public.principal_groups
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    preschool_id IN (
      SELECT COALESCE(p.organization_id, p.preschool_id)
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  )
  WITH CHECK (
    preschool_id IN (
      SELECT COALESCE(p.organization_id, p.preschool_id)
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = ANY (ARRAY['teacher'::text, 'admin'::text, 'principal'::text, 'principal_admin'::text])
    )
  );

  -- Replace select policy
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'principal_groups'
      AND policyname = 'principal_groups_tenant_select'
  ) THEN
    DROP POLICY "principal_groups_tenant_select" ON public.principal_groups;
  END IF;

  CREATE POLICY "principal_groups_tenant_select"
  ON public.principal_groups
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    preschool_id IN (
      SELECT COALESCE(p.organization_id, p.preschool_id)
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );
END;
$do$;

