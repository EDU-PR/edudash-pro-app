-- Simplified RLS policy that doesn't reference the table column in EXISTS
-- This should work better with PostgREST's evaluation

-- Drop the existing policy
DROP POLICY IF EXISTS "principals_select_aftercare_own_school" ON public.aftercare_registrations;

-- Create a simpler policy that uses a subquery to get the user's school ID first
CREATE POLICY "principals_select_aftercare_own_school"
ON public.aftercare_registrations
FOR SELECT
TO authenticated
USING (
  -- User is a principal/admin
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('principal', 'principal_admin', 'super_admin')
  )
  AND
  -- Registration's preschool_id matches user's school
  preschool_id IN (
    SELECT COALESCE(organization_id, preschool_id)
    FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('principal', 'principal_admin', 'super_admin')
  )
);

-- Also update the UPDATE policy
DROP POLICY IF EXISTS "principals_update_aftercare" ON public.aftercare_registrations;

CREATE POLICY "principals_update_aftercare"
ON public.aftercare_registrations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('principal', 'principal_admin', 'super_admin')
  )
  AND
  preschool_id IN (
    SELECT COALESCE(organization_id, preschool_id)
    FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('principal', 'principal_admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('principal', 'principal_admin', 'super_admin')
  )
  AND
  preschool_id IN (
    SELECT COALESCE(organization_id, preschool_id)
    FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('principal', 'principal_admin', 'super_admin')
  )
);

-- Ensure RLS is enabled
ALTER TABLE public.aftercare_registrations ENABLE ROW LEVEL SECURITY;
