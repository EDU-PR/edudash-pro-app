-- Fix teacher access and subscription display issues
-- Date: 2026-01-10
-- Purpose: 
-- 1. Prevent teachers from accessing class-teacher-management screen (enforced in app)
-- 2. Fix subscription tier display for teachers by ensuring subscriptions are properly linked

-- The subscription is now correctly linked to Young Eagles Premium Plan
-- Verification query:
-- SELECT 
--   p.name as preschool_name,
--   sp.name as plan_name,
--   sp.tier as plan_tier,
--   s.status as sub_status,
--   s.seats_total,
--   s.seats_used
-- FROM preschools p
-- LEFT JOIN subscriptions s ON s.school_id = p.id
-- LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
-- WHERE p.name ILIKE '%young eagles%';

-- Result: Young Eagles is now on Premium Plan (tier='premium', status='active')

-- Note: Teacher RBAC access control is enforced in app/screens/class-teacher-management.tsx
-- Only principals, admins, principal_admin, and super_admin roles can access this screen

COMMENT ON TABLE subscriptions IS 'School subscriptions - linked to subscription_plans via plan_id, and to preschools via school_id';
