-- Migration: Fix EduDash Pro school types
-- The EduDash Pro Community School and Main School are not preschools
-- They accept students of all ages

-- Update EduDash Pro Community School to be a community school (all ages)
UPDATE preschools 
SET school_type = 'community_school'
WHERE name ILIKE '%EduDash Pro Community School%'
  AND (school_type IS NULL OR school_type = 'preschool');

-- Update EduDash Pro Main School to be a K-12 school
UPDATE preschools 
SET school_type = 'k12'
WHERE name ILIKE '%EduDash Pro Main School%'
  AND (school_type IS NULL OR school_type = 'preschool');

-- Also update any schools that have K-12 or similar in their name
UPDATE preschools
SET school_type = 'k12'
WHERE (name ILIKE '%K-12%' OR name ILIKE '%K12%')
  AND (school_type IS NULL OR school_type = 'preschool');

-- Update primary schools
UPDATE preschools
SET school_type = 'primary'
WHERE (name ILIKE '%Primary School%' OR name ILIKE '%Primary%')
  AND name NOT ILIKE '%Preschool%'
  AND name NOT ILIKE '%Pre-school%'
  AND (school_type IS NULL OR school_type = 'preschool');

-- Update secondary/high schools
UPDATE preschools
SET school_type = 'secondary'
WHERE (name ILIKE '%High School%' OR name ILIKE '%Secondary%' OR name ILIKE '%College%')
  AND name NOT ILIKE '%Preschool%'
  AND name NOT ILIKE '%Pre-school%'
  AND (school_type IS NULL OR school_type = 'preschool');

-- Update training centers
UPDATE preschools
SET school_type = 'training_center'
WHERE (name ILIKE '%Training%' OR name ILIKE '%Academy%')
  AND name NOT ILIKE '%Preschool%'
  AND name NOT ILIKE '%Pre-school%'
  AND name NOT ILIKE '%Primary%'
  AND (school_type IS NULL OR school_type = 'preschool');

-- Ensure all remaining schools without a type default to 'preschool'
UPDATE preschools
SET school_type = 'preschool'
WHERE school_type IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN preschools.school_type IS 'Type of school: preschool, primary, secondary, k12, combined, community_school, training_center, skills_development, tutoring_center';
