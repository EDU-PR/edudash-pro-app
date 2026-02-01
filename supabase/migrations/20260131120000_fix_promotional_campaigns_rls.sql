-- Allow principals/admins to manage promotional campaigns created within their org

ALTER TABLE public.promotional_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage campaigns" ON public.promotional_campaigns;
DROP POLICY IF EXISTS promotional_campaigns_org_select ON public.promotional_campaigns;
DROP POLICY IF EXISTS promotional_campaigns_org_insert ON public.promotional_campaigns;
DROP POLICY IF EXISTS promotional_campaigns_org_update ON public.promotional_campaigns;
DROP POLICY IF EXISTS promotional_campaigns_org_delete ON public.promotional_campaigns;

CREATE POLICY promotional_campaigns_org_select
ON public.promotional_campaigns
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles me
    WHERE me.id = auth.uid()
      AND me.role IN ('superadmin', 'super_admin')
  )
  OR
  EXISTS (
    SELECT 1
    FROM public.profiles me
    JOIN public.profiles owner
      ON owner.id = promotional_campaigns.created_by
    WHERE me.id = auth.uid()
      AND me.role IN ('principal', 'principal_admin', 'admin')
      AND COALESCE(me.organization_id, me.preschool_id) = COALESCE(owner.organization_id, owner.preschool_id)
  )
);

CREATE POLICY promotional_campaigns_org_insert
ON public.promotional_campaigns
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles me
    WHERE me.id = auth.uid()
      AND me.role IN ('superadmin', 'super_admin')
  )
  OR (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.role IN ('principal', 'principal_admin', 'admin')
    )
  )
);

CREATE POLICY promotional_campaigns_org_update
ON public.promotional_campaigns
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles me
    WHERE me.id = auth.uid()
      AND me.role IN ('superadmin', 'super_admin')
  )
  OR
  EXISTS (
    SELECT 1
    FROM public.profiles me
    JOIN public.profiles owner
      ON owner.id = promotional_campaigns.created_by
    WHERE me.id = auth.uid()
      AND me.role IN ('principal', 'principal_admin', 'admin')
      AND COALESCE(me.organization_id, me.preschool_id) = COALESCE(owner.organization_id, owner.preschool_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles me
    WHERE me.id = auth.uid()
      AND me.role IN ('superadmin', 'super_admin')
  )
  OR
  EXISTS (
    SELECT 1
    FROM public.profiles me
    JOIN public.profiles owner
      ON owner.id = promotional_campaigns.created_by
    WHERE me.id = auth.uid()
      AND me.role IN ('principal', 'principal_admin', 'admin')
      AND COALESCE(me.organization_id, me.preschool_id) = COALESCE(owner.organization_id, owner.preschool_id)
  )
);

CREATE POLICY promotional_campaigns_org_delete
ON public.promotional_campaigns
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles me
    WHERE me.id = auth.uid()
      AND me.role IN ('superadmin', 'super_admin')
  )
  OR
  EXISTS (
    SELECT 1
    FROM public.profiles me
    JOIN public.profiles owner
      ON owner.id = promotional_campaigns.created_by
    WHERE me.id = auth.uid()
      AND me.role IN ('principal', 'principal_admin', 'admin')
      AND COALESCE(me.organization_id, me.preschool_id) = COALESCE(owner.organization_id, owner.preschool_id)
  )
);
