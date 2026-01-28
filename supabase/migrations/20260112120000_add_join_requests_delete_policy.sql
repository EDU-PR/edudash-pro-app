-- Add DELETE policy for join_requests table
-- Allows users to delete invite codes they created
-- 
-- Issue: The delete button on the youth-invite-code screen doesn't work
-- because there's no RLS policy allowing DELETE on join_requests
--
-- Date: 2026-01-12

BEGIN;

-- Grant DELETE permission on join_requests to authenticated users
GRANT DELETE ON public.join_requests TO authenticated;

-- Allow users to delete invite codes they created (invited_by)
DROP POLICY IF EXISTS "users_delete_own_invite_codes" ON public.join_requests;
CREATE POLICY "users_delete_own_invite_codes"
ON public.join_requests
FOR DELETE
TO authenticated
USING (
  -- Only allow deleting invite codes that the user created
  invited_by = auth.uid()
  -- Only allow deleting invites with codes (not other join requests)
  AND invite_code IS NOT NULL
);

-- Also allow organization admins to delete any invite code in their org
-- This is useful for Youth Presidents, Regional Managers, etc.
DROP POLICY IF EXISTS "org_admins_delete_invite_codes" ON public.join_requests;
CREATE POLICY "org_admins_delete_invite_codes"
ON public.join_requests
FOR DELETE
TO authenticated
USING (
  invite_code IS NOT NULL
  AND organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
    AND member_type IN (
      'youth_president', 
      'youth_secretary', 
      'regional_manager', 
      'national_admin',
      'president',
      'ceo',
      'board_member'
    )
  )
);

COMMIT;
