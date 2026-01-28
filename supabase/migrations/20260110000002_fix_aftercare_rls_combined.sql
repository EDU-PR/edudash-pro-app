-- Fix RLS policy by combining parent and principal logic into a single policy
-- PostgREST may have issues evaluating multiple permissive policies for the same role
-- Solution: Create a single comprehensive SELECT policy for authenticated users

-- Shadow DB safety: ensure profiles has required columns
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  role TEXT,
  organization_id UUID,
  preschool_id UUID
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT,
  ADD COLUMN IF NOT EXISTS organization_id UUID,
  ADD COLUMN IF NOT EXISTS preschool_id UUID;

-- Drop existing SELECT policies for authenticated users
DROP POLICY IF EXISTS "principals_select_aftercare_own_school" ON public.aftercare_registrations;
DROP POLICY IF EXISTS "parents_select_own_aftercare" ON public.aftercare_registrations;

-- Create a single comprehensive SELECT policy that handles both parents and principals
CREATE POLICY "authenticated_select_aftercare"
ON public.aftercare_registrations
FOR SELECT
TO authenticated
USING (
  -- Principals can see registrations for their school
  (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('principal', 'principal_admin', 'super_admin')
      AND preschool_id = COALESCE(p.organization_id, p.preschool_id)
    )
  )
  OR
  -- Parents can see their own registrations (by user_id or email match)
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
);

-- Keep UPDATE policies separate as they have different logic
-- (principals can update any registration in their school, parents can only update their own)

-- Ensure RLS is enabled
ALTER TABLE public.aftercare_registrations ENABLE ROW LEVEL SECURITY;
