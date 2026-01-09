-- Fix RLS policy for principals to access aftercare_registrations
-- The issue: The subquery in the policy might return NULL, causing the policy to fail
-- Solution: Use a simpler, more direct policy that joins properly

-- Drop the existing policy
DROP POLICY IF EXISTS "principals_select_aftercare_own_school" ON public.aftercare_registrations;

-- Create a simpler, more robust policy
CREATE POLICY "principals_select_aftercare_own_school"
ON public.aftercare_registrations
FOR SELECT
TO authenticated
USING (
  -- Check if user is a principal/admin and their school matches
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('principal', 'principal_admin', 'super_admin')
    AND aftercare_registrations.preschool_id = COALESCE(p.organization_id, p.preschool_id)
  )
);

-- Also update the UPDATE policy to use the same pattern
DROP POLICY IF EXISTS "principals_update_aftercare" ON public.aftercare_registrations;

CREATE POLICY "principals_update_aftercare"
ON public.aftercare_registrations
FOR UPDATE
TO authenticated
USING (
  -- Principals can update registrations for their school
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('principal', 'principal_admin', 'super_admin')
    AND aftercare_registrations.preschool_id = COALESCE(p.organization_id, p.preschool_id)
  )
)
WITH CHECK (
  -- Same check for WITH CHECK clause
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('principal', 'principal_admin', 'super_admin')
    AND aftercare_registrations.preschool_id = COALESCE(p.organization_id, p.preschool_id)
  )
);

-- Ensure RLS is enabled
ALTER TABLE public.aftercare_registrations ENABLE ROW LEVEL SECURITY;
