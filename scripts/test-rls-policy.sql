-- Test RLS policy for aftercare_registrations
-- Simulate the authenticated user query

-- First, check what the policy should evaluate to
SELECT 
  p.id as user_id,
  p.email,
  p.role,
  p.organization_id,
  p.preschool_id,
  COALESCE(p.organization_id, p.preschool_id) as resolved_org_id,
  '00000000-0000-0000-0000-000000000001' as target_preschool_id,
  CASE 
    WHEN p.role IN ('principal', 'principal_admin', 'super_admin') THEN 'YES'
    ELSE 'NO'
  END as is_principal,
  CASE 
    WHEN '00000000-0000-0000-0000-000000000001' = COALESCE(p.organization_id, p.preschool_id) THEN 'YES'
    ELSE 'NO'
  END as org_matches
FROM profiles p
WHERE p.id = 'd78e273f-d2d9-4000-a11c-225ea9cf7e22';

-- Test the EXISTS clause that the policy uses
SELECT 
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = 'd78e273f-d2d9-4000-a11c-225ea9cf7e22'
    AND p.role IN ('principal', 'principal_admin', 'super_admin')
    AND '00000000-0000-0000-0000-000000000001' = COALESCE(p.organization_id, p.preschool_id)
  ) as policy_should_allow;
