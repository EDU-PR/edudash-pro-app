-- Fix RLS for marketing_campaigns so principals/admins can manage their org's campaigns

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Preschool staff manage campaigns" ON public.marketing_campaigns;
DROP POLICY IF EXISTS "Anyone can view active campaigns" ON public.marketing_campaigns;
DROP POLICY IF EXISTS marketing_campaigns_org_manage ON public.marketing_campaigns;
DROP POLICY IF EXISTS marketing_campaigns_public_active_select ON public.marketing_campaigns;

CREATE POLICY marketing_campaigns_public_active_select
ON public.marketing_campaigns
FOR SELECT
TO anon, authenticated
USING ((active = true) AND (start_date <= now()) AND (end_date >= now()));

CREATE POLICY marketing_campaigns_org_manage
ON public.marketing_campaigns
FOR ALL
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
    WHERE me.id = auth.uid()
      AND me.role IN ('principal', 'principal_admin', 'admin', 'teacher')
      AND marketing_campaigns.organization_id = COALESCE(me.organization_id, me.preschool_id)
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
    WHERE me.id = auth.uid()
      AND me.role IN ('principal', 'principal_admin', 'admin', 'teacher')
      AND marketing_campaigns.organization_id = COALESCE(me.organization_id, me.preschool_id)
  )
);
