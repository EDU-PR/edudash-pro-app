-- Fix K-12 Parent Dashboard Routing for zinhlenong32@gmail.com
-- Parent's child (Mbali Skosana) attends EduDash Pro Community School (K-12)
-- This script ensures the parent has the correct organization_id set

-- ROOT CAUSE ANALYSIS:
-- The code prioritizes preschool_id lookup in preschools table BEFORE organizations table.
-- If the school exists in BOTH tables with different school_type values, the preschool value wins.
-- This script also ensures the preschools table has correct school_type for K-12 schools.

-- Step 1: DIAGNOSTIC - Check both tables for this school ID
-- CRITICAL: This reveals if school exists in both tables with conflicting types

-- Check in preschools table
SELECT 
  'PRESCHOOLS TABLE' as source,
  id, name, school_type, subscription_tier
FROM preschools
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Check in organizations table  
SELECT 
  'ORGANIZATIONS TABLE' as source,
  id, name, type as school_type, plan_tier
FROM organizations
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Step 2: Check parent's profile settings
SELECT 
  p.id as profile_id,
  p.email,
  p.role,
  p.organization_id,
  p.preschool_id,
  p.seat_status,
  p.tenant_slug
FROM profiles p
WHERE p.email = 'zinhlenong32@gmail.com';

-- Check the student's organization/parent relationship
SELECT 
  s.id as student_id,
  s.first_name || ' ' || s.last_name as student_name,
  s.grade,
  s.grade_level,
  s.class_id,
  s.organization_id as student_org_id,
  s.preschool_id as student_preschool_id,
  s.parent_id
FROM students s
WHERE s.first_name = 'Mbali' AND s.last_name = 'Skosana';

-- Step 3: THE FIX - Update preschools table school_type if it exists there
-- Since the code checks preschools FIRST, we need to set school_type there
-- This is the PRIMARY fix that will enable K-12 routing

UPDATE preschools 
SET 
  school_type = 'k12_school',
  updated_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000001'
  AND (school_type IS NULL OR school_type != 'k12_school');

-- Step 4: Also update parent's organization_id if needed
-- This ensures the parent is associated with the K-12 school
UPDATE profiles 
SET 
  organization_id = '00000000-0000-0000-0000-000000000001',
  preschool_id = '00000000-0000-0000-0000-000000000001',
  updated_at = NOW()
WHERE id = '236d04e0-19ff-43d1-a0e2-17223ecb6d9b'
  AND (
    organization_id IS NULL 
    OR organization_id != '00000000-0000-0000-0000-000000000001'
  );

-- Step 5: Verify the fix was applied
SELECT 
  p.id as profile_id,
  p.email,
  p.role,
  p.organization_id,
  p.preschool_id,
  p.seat_status,
  pre.name as preschool_name,
  pre.school_type as preschool_school_type,
  o.name as org_name,
  o.type as org_type
FROM profiles p
LEFT JOIN preschools pre ON pre.id = p.preschool_id
LEFT JOIN organizations o ON o.id = p.organization_id
WHERE p.email = 'zinhlenong32@gmail.com';

-- Note: After running this:
-- 1. The preschools.school_type will be 'k12_school' (PRIMARY FIX)
-- 2. The parent's profile will have organization_id set
-- 3. The routing code will find school_type='k12_school' from preschools table
-- 4. Parent will be routed to K-12 dashboard
