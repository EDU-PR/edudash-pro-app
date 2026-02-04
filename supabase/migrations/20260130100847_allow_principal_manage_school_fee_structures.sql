-- Allow principals/admins to manage school fee structures (including uniforms)

DO $$
BEGIN
  IF to_regclass('public.school_fee_structures') IS NULL THEN
    RAISE NOTICE 'Skipping school_fee_structures policies: table missing';
    RETURN;
  END IF;

  ALTER TABLE public.school_fee_structures ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS principals_manage_school_fee_structures_select ON public.school_fee_structures;
  CREATE POLICY principals_manage_school_fee_structures_select
  ON public.school_fee_structures
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('principal', 'principal_admin', 'admin', 'super_admin')
    )
    AND
    preschool_id IN (
      SELECT COALESCE(organization_id, preschool_id)
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('principal', 'principal_admin', 'admin', 'super_admin')
    )
  );

  DROP POLICY IF EXISTS principals_manage_school_fee_structures_insert ON public.school_fee_structures;
  CREATE POLICY principals_manage_school_fee_structures_insert
  ON public.school_fee_structures
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('principal', 'principal_admin', 'admin', 'super_admin')
    )
    AND
    preschool_id IN (
      SELECT COALESCE(organization_id, preschool_id)
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('principal', 'principal_admin', 'admin', 'super_admin')
    )
  );

  DROP POLICY IF EXISTS principals_manage_school_fee_structures_update ON public.school_fee_structures;
  CREATE POLICY principals_manage_school_fee_structures_update
  ON public.school_fee_structures
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('principal', 'principal_admin', 'admin', 'super_admin')
    )
    AND
    preschool_id IN (
      SELECT COALESCE(organization_id, preschool_id)
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('principal', 'principal_admin', 'admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('principal', 'principal_admin', 'admin', 'super_admin')
    )
    AND
    preschool_id IN (
      SELECT COALESCE(organization_id, preschool_id)
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('principal', 'principal_admin', 'admin', 'super_admin')
    )
  );

  DROP POLICY IF EXISTS principals_manage_school_fee_structures_delete ON public.school_fee_structures;
  CREATE POLICY principals_manage_school_fee_structures_delete
  ON public.school_fee_structures
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('principal', 'principal_admin', 'admin', 'super_admin')
    )
    AND
    preschool_id IN (
      SELECT COALESCE(organization_id, preschool_id)
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('principal', 'principal_admin', 'admin', 'super_admin')
    )
  );
END $$;
