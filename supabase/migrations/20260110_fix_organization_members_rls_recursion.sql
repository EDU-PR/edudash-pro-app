-- Fix organization_members RLS infinite recursion
-- Similar to the document RLS fix, we need security definer functions

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Members can view organization members" ON public.organization_members;
DROP POLICY IF EXISTS "Admins can manage organization members" ON public.organization_members;

-- Create security definer function to check if user can view organization members
CREATE OR REPLACE FUNCTION user_can_view_org_members(target_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the authenticated user is a member of the target organization
  RETURN EXISTS (
    SELECT 1
    FROM organization_members
    WHERE user_id = auth.uid()
      AND organization_id = target_org_id
      AND seat_status = 'active'
  );
END;
$$;

-- Create security definer function to check if user can manage organization members
CREATE OR REPLACE FUNCTION user_can_manage_org_members(target_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the authenticated user has admin/executive roles in the target organization
  RETURN EXISTS (
    SELECT 1
    FROM organization_members
    WHERE user_id = auth.uid()
      AND organization_id = target_org_id
      AND seat_status = 'active'
      AND (
        member_type IN ('ceo', 'president', 'deputy_president', 'secretary_general', 'treasurer', 
                       'national_admin', 'national_coordinator', 'executive', 'board_member',
                       'youth_president', 'youth_deputy', 'youth_secretary', 'youth_treasurer',
                       'women_president', 'women_deputy', 'women_secretary',
                       'veterans_president')
        OR role IN ('admin', 'super_admin')
      )
  );
END;
$$;

-- Re-create policies using security definer functions
CREATE POLICY "Members can view organization members"
ON public.organization_members
FOR SELECT
USING (user_can_view_org_members(organization_id));

CREATE POLICY "Admins can manage organization members"
ON public.organization_members
FOR ALL
USING (user_can_manage_org_members(organization_id))
WITH CHECK (user_can_manage_org_members(organization_id));

-- Add comments
COMMENT ON FUNCTION user_can_view_org_members IS 
'Security definer function to check if user can view organization members without infinite recursion';

COMMENT ON FUNCTION user_can_manage_org_members IS 
'Security definer function to check if user can manage organization members without infinite recursion';
