-- Test RLS policy evaluation with proper auth context
-- This simulates what PostgREST does when evaluating policies

-- Set up auth context (simulating authenticated user)
SET ROLE authenticated;
SET request.jwt.claim.sub = 'd78e273f-d2d9-4000-a11c-225ea9cf7e22';

-- Test if we can see the registrations
SELECT COUNT(*) as registration_count
FROM aftercare_registrations
WHERE preschool_id = '00000000-0000-0000-0000-000000000001';

-- Test each policy individually
SELECT 
  'principals_select_aftercare_own_school' as policy_name,
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = 'd78e273f-d2d9-4000-a11c-225ea9cf7e22'
    AND p.role IN ('principal', 'principal_admin', 'super_admin')
    AND '00000000-0000-0000-0000-000000000001' = COALESCE(p.organization_id, p.preschool_id)
  ) as should_match;

SELECT 
  'parents_select_own_aftercare' as policy_name,
  EXISTS (
    SELECT 1
    FROM aftercare_registrations ar
    WHERE ar.preschool_id = '00000000-0000-0000-0000-000000000001'
    AND (
      ar.parent_user_id = 'd78e273f-d2d9-4000-a11c-225ea9cf7e22'
      OR ar.parent_email IN (
        SELECT email FROM auth.users WHERE id = 'd78e273f-d2d9-4000-a11c-225ea9cf7e22'
      )
    )
  ) as should_match;
