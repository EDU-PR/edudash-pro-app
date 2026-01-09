-- Fix UPDATE RLS policy for aftercare_registrations
-- Combine principals and parents policies into single policy to avoid PostgREST evaluation issues

-- Drop existing UPDATE policies
DROP POLICY IF EXISTS "principals_update_aftercare" ON public.aftercare_registrations;
DROP POLICY IF EXISTS "parents_update_own_aftercare" ON public.aftercare_registrations;

-- Create single comprehensive UPDATE policy for authenticated users
CREATE POLICY "authenticated_update_aftercare"
ON public.aftercare_registrations
FOR UPDATE
TO authenticated
USING (
  -- Principals can update registrations for their school
  (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('principal', 'principal_admin', 'super_admin')
      AND preschool_id IN (
        SELECT COALESCE(organization_id, preschool_id)
        FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('principal', 'principal_admin', 'super_admin')
      )
    )
  )
  OR
  -- Parents can update their own pending/paid registrations
  (
    (
      parent_user_id = auth.uid()
      OR
      EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.email = aftercare_registrations.parent_email
      )
    )
    AND status IN ('pending_payment', 'paid')
  )
)
WITH CHECK (
  -- Same checks for WITH CHECK clause
  (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('principal', 'principal_admin', 'super_admin')
      AND preschool_id IN (
        SELECT COALESCE(organization_id, preschool_id)
        FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('principal', 'principal_admin', 'super_admin')
      )
    )
  )
  OR
  (
    (
      parent_user_id = auth.uid()
      OR
      EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.email = aftercare_registrations.parent_email
      )
    )
    AND status IN ('pending_payment', 'paid')
  )
);

-- Ensure RLS is enabled
ALTER TABLE public.aftercare_registrations ENABLE ROW LEVEL SECURITY;
