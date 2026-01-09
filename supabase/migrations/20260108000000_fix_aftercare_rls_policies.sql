-- Fix RLS policies for aftercare_registrations table
-- Allow authenticated users to insert their own registrations

-- Policy: Authenticated users can insert their own aftercare registrations
-- They can insert if:
-- 1. parent_user_id matches auth.uid() (if set), OR
-- 2. parent_email matches their profile email (for web registrations without auth)
DROP POLICY IF EXISTS "authenticated_insert_aftercare" ON public.aftercare_registrations;
CREATE POLICY "authenticated_insert_aftercare"
ON public.aftercare_registrations
FOR INSERT
TO authenticated
WITH CHECK (
  -- Option 1: parent_user_id matches authenticated user
  (parent_user_id IS NOT NULL AND parent_user_id = auth.uid())
  OR
  -- Option 2: parent_email matches authenticated user's email
  (parent_email IN (
    SELECT email FROM auth.users WHERE id = auth.uid()
  ))
  OR
  -- Option 3: Allow if parent_user_id is NULL (will be set by trigger or later)
  (parent_user_id IS NULL)
);

-- Policy: Allow anonymous users to insert (for public web registrations)
-- Keep the existing anon policy but ensure it's properly configured
DROP POLICY IF EXISTS "anon_insert_aftercare" ON public.aftercare_registrations;
CREATE POLICY "anon_insert_aftercare"
ON public.aftercare_registrations
FOR INSERT
TO anon
WITH CHECK (true); -- Allow all anonymous inserts (public registration form)

-- Policy: Principals can view all registrations for their school
DROP POLICY IF EXISTS "principals_select_aftercare" ON public.aftercare_registrations;
CREATE POLICY "principals_select_aftercare"
ON public.aftercare_registrations
FOR SELECT
TO authenticated
USING (
  -- Principals can see registrations for their school
  preschool_id IN (
    SELECT COALESCE(organization_id, preschool_id)
    FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('principal', 'principal_admin', 'super_admin')
  )
);

-- Policy: Parents can view their own registrations
DROP POLICY IF EXISTS "parents_select_own_aftercare" ON public.aftercare_registrations;
CREATE POLICY "parents_select_own_aftercare"
ON public.aftercare_registrations
FOR SELECT
TO authenticated
USING (
  -- Parents can see their own registrations
  parent_user_id = auth.uid()
  OR
  parent_email IN (
    SELECT email FROM auth.users WHERE id = auth.uid()
  )
);

-- Policy: Principals can update registrations for their school
DROP POLICY IF EXISTS "principals_update_aftercare" ON public.aftercare_registrations;
CREATE POLICY "principals_update_aftercare"
ON public.aftercare_registrations
FOR UPDATE
TO authenticated
USING (
  -- Principals can update registrations for their school
  preschool_id IN (
    SELECT COALESCE(organization_id, preschool_id)
    FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('principal', 'principal_admin', 'super_admin')
  )
)
WITH CHECK (
  -- Same check for WITH CHECK clause
  preschool_id IN (
    SELECT COALESCE(organization_id, preschool_id)
    FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('principal', 'principal_admin', 'super_admin')
  )
);

-- Policy: Parents can update their own pending registrations (e.g., upload POP)
DROP POLICY IF EXISTS "parents_update_own_aftercare" ON public.aftercare_registrations;
CREATE POLICY "parents_update_own_aftercare"
ON public.aftercare_registrations
FOR UPDATE
TO authenticated
USING (
  -- Parents can update their own pending registrations
  (
    parent_user_id = auth.uid()
    OR
    parent_email IN (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  )
  AND status IN ('pending_payment', 'paid') -- Only allow updates to pending/paid status
)
WITH CHECK (
  -- Same check for WITH CHECK clause
  (
    parent_user_id = auth.uid()
    OR
    parent_email IN (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  )
  AND status IN ('pending_payment', 'paid')
);

-- Ensure RLS is enabled
ALTER TABLE public.aftercare_registrations ENABLE ROW LEVEL SECURITY;
