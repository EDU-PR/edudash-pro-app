-- Allow national_admin (CEO) to update their organization
-- This is needed for wallpaper settings and other org customizations

-- Drop the existing policy and recreate with national_admin support
DROP POLICY IF EXISTS organizations_update_admins ON public.organizations;

-- Recreate with national_admin support via organization_members table
CREATE POLICY organizations_update_admins
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  app_auth.is_superadmin() 
  OR app_auth.is_principal() AND app_auth.has_org_access(id)
  OR EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
    AND om.organization_id = organizations.id
    AND om.role IN ('national_admin', 'admin')
  )
)
WITH CHECK (
  app_auth.is_superadmin() 
  OR app_auth.is_principal() AND app_auth.has_org_access(id)
  OR EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
    AND om.organization_id = organizations.id
    AND om.role IN ('national_admin', 'admin')
  )
);

-- Also ensure organization_members can be read for this check
-- Add policy for authenticated users to read their own membership
DROP POLICY IF EXISTS organization_members_select_own ON public.organization_members;
CREATE POLICY organization_members_select_own
ON public.organization_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
