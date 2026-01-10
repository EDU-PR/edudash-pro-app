-- Fix preschools RLS to allow teachers to read their own preschool data
-- Date: 2026-01-10
-- Issue: Teachers getting 400 error when trying to read preschools table
-- Root cause: RLS policies check organization_id but teachers have preschool_id set

-- Add policy to allow users to read preschools where they are assigned via preschool_id
CREATE POLICY "preschools_user_read_via_preschool_id"
ON public.preschools
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT p.preschool_id
    FROM public.profiles p
    WHERE p.id = auth.uid() AND p.preschool_id IS NOT NULL
  )
);

COMMENT ON POLICY "preschools_user_read_via_preschool_id" ON public.preschools IS
'Allows users (especially teachers) to read preschool data where their profile.preschool_id matches';
