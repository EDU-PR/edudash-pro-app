-- Ensure table-level grants for aftercare_registrations
-- These grants are required in addition to RLS policies

-- Grant permissions to anon role (for public web registrations)
GRANT INSERT ON public.aftercare_registrations TO anon;
GRANT SELECT ON public.aftercare_registrations TO anon;

-- Grant permissions to authenticated role
GRANT INSERT ON public.aftercare_registrations TO authenticated;
GRANT SELECT ON public.aftercare_registrations TO authenticated;
GRANT UPDATE ON public.aftercare_registrations TO authenticated;

-- Ensure RLS is enabled
ALTER TABLE public.aftercare_registrations ENABLE ROW LEVEL SECURITY;

-- Recreate anon insert policy to ensure it's correct
DROP POLICY IF EXISTS "anon_insert_aftercare" ON public.aftercare_registrations;
CREATE POLICY "anon_insert_aftercare"
ON public.aftercare_registrations
FOR INSERT
TO anon
WITH CHECK (true);

-- Add SELECT policy for anon users (needed for PostgREST to return inserted rows)
DROP POLICY IF EXISTS "anon_select_aftercare" ON public.aftercare_registrations;
CREATE POLICY "anon_select_aftercare"
ON public.aftercare_registrations
FOR SELECT
TO anon
USING (true);
