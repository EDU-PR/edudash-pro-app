-- Fix Mbali assignment and teacher subscription tier display
-- Date: 2026-01-10

-- 1. Assign Mbali Skosana to Curious Cubs class
UPDATE students
SET class_id = 'ac257aa6-bb6a-47b6-9fce-d3c724b120b9'
WHERE id = '074692f3-f5a3-4fea-977a-b726828e5067' 
  AND first_name = 'Mbali' 
  AND last_name = 'Skosana';

-- 2. Update teacher profile to reflect school's premium subscription
UPDATE profiles
SET subscription_tier = 'school_premium'
WHERE id = 'a1fd12d2-5f09-4a23-822d-f3071bfc544b' 
  AND email = 'katso@youngeagles.org.za';

-- Verification queries:
-- Check Mbali's assignment:
-- SELECT s.first_name, s.last_name, c.name as class_name, c.grade_level
-- FROM students s
-- LEFT JOIN classes c ON s.class_id = c.id
-- WHERE s.id = '074692f3-f5a3-4fea-977a-b726828e5067';

-- Check teacher subscription:
-- SELECT prof.email, prof.subscription_tier, sp.tier as plan_tier
-- FROM profiles prof
-- LEFT JOIN preschools pres ON prof.preschool_id = pres.id
-- LEFT JOIN subscriptions sub ON sub.school_id = pres.id AND sub.status = 'active'
-- LEFT JOIN subscription_plans sp ON sub.plan_id = sp.id
-- WHERE prof.email = 'katso@youngeagles.org.za';

COMMENT ON TABLE students IS 'Students table - class_id links to classes table';
COMMENT ON COLUMN profiles.subscription_tier IS 'User subscription tier - for teachers, should match school subscription (e.g., school_premium, school_starter)';
