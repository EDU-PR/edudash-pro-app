-- Fix RBAC routing for Youth President and Youth Secretary
-- Ensures users route to correct dashboards based on member_type

-- Update Youth President role from 'admin' to 'parent'
-- This prevents isSuperAdmin() checks from incorrectly matching
-- Routing will be handled by member_type='youth_president' in organization_members
UPDATE profiles
SET role = 'parent'
WHERE email = 'hlorisom@soilofafrica.org'
  AND role = 'admin';

-- Activate Youth Secretary's seat status
-- This allows access to Youth Secretary dashboard
UPDATE organization_members
SET seat_status = 'active'
WHERE user_id = (SELECT id FROM profiles WHERE email = 'ksaukazi@gmail.com')
  AND member_type = 'youth_secretary'
  AND seat_status = 'inactive';

-- Add comment
COMMENT ON TABLE organization_members IS 
'Organization membership table. member_type takes priority over profile.role for routing decisions in SOA organizations.';
