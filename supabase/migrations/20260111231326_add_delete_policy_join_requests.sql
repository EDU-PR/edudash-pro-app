-- Migration: Add DELETE policy for join_requests table
-- This allows Youth President/Secretary to delete invite codes they created or for their organization

-- Note: This policy was applied directly to production via psql
-- This migration file documents the change for version control

-- The policy allows authenticated users to delete join_requests if:
-- 1. They are the one who invited (invited_by = auth.uid())
-- 2. OR they are an admin in the same organization (president, secretary, etc.)

-- Check if policy exists before creating (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'join_requests' 
    AND policyname = 'Admins can delete invite codes'
  ) THEN
    CREATE POLICY "Admins can delete invite codes"
    ON public.join_requests
    FOR DELETE
    TO authenticated
    USING (
      invited_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
        AND om.organization_id = join_requests.organization_id
        AND om.member_type IN ('president', 'secretary', 'ceo', 'board_member', 'executive', 'staff', 'youth_president', 'youth_secretary')
      )
    );
  END IF;
END $$;
