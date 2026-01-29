-- Migration: Fix EduDash Pro school types
-- The EduDash Pro Community School and Main School are not preschools
-- They accept students of all ages

DO $$
DECLARE
  preschools_exists BOOLEAN;
  has_name BOOLEAN;
  has_school_type BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'preschools'
  ) INTO preschools_exists;

  IF NOT preschools_exists THEN
    RAISE NOTICE 'Skipping school type updates: preschools table missing';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'preschools'
      AND column_name = 'name'
  ) INTO has_name;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'preschools'
      AND column_name = 'school_type'
  ) INTO has_school_type;

  IF NOT (has_name AND has_school_type) THEN
    RAISE NOTICE 'Skipping school type updates: preschools.name or preschools.school_type missing';
    RETURN;
  END IF;

  -- Update EduDash Pro Community School to be a community school (all ages)
  EXECUTE $sql$UPDATE preschools 
    SET school_type = 'community_school'
    WHERE name ILIKE '%EduDash Pro Community School%'
      AND (school_type IS NULL OR school_type = 'preschool')$sql$;

  -- Update EduDash Pro Main School to be a K-12 school
  EXECUTE $sql$UPDATE preschools 
    SET school_type = 'k12'
    WHERE name ILIKE '%EduDash Pro Main School%'
      AND (school_type IS NULL OR school_type = 'preschool')$sql$;

  -- Also update any schools that have K-12 or similar in their name
  EXECUTE $sql$UPDATE preschools
    SET school_type = 'k12'
    WHERE (name ILIKE '%K-12%' OR name ILIKE '%K12%')
      AND (school_type IS NULL OR school_type = 'preschool')$sql$;

  -- Update primary schools
  EXECUTE $sql$UPDATE preschools
    SET school_type = 'primary'
    WHERE (name ILIKE '%Primary School%' OR name ILIKE '%Primary%')
      AND name NOT ILIKE '%Preschool%'
      AND name NOT ILIKE '%Pre-school%'
      AND (school_type IS NULL OR school_type = 'preschool')$sql$;

  -- Update secondary/high schools
  EXECUTE $sql$UPDATE preschools
    SET school_type = 'secondary'
    WHERE (name ILIKE '%High School%' OR name ILIKE '%Secondary%' OR name ILIKE '%College%')
      AND name NOT ILIKE '%Preschool%'
      AND name NOT ILIKE '%Pre-school%'
      AND (school_type IS NULL OR school_type = 'preschool')$sql$;

  -- Update training centers
  EXECUTE $sql$UPDATE preschools
    SET school_type = 'training_center'
    WHERE (name ILIKE '%Training%' OR name ILIKE '%Academy%')
      AND name NOT ILIKE '%Preschool%'
      AND name NOT ILIKE '%Pre-school%'
      AND name NOT ILIKE '%Primary%'
      AND (school_type IS NULL OR school_type = 'preschool')$sql$;

  -- Ensure all remaining schools without a type default to 'preschool'
  EXECUTE $sql$UPDATE preschools
    SET school_type = 'preschool'
    WHERE school_type IS NULL$sql$;

  -- Add comment for documentation
  EXECUTE $sql$COMMENT ON COLUMN preschools.school_type IS 'Type of school: preschool, primary, secondary, k12, combined, community_school, training_center, skills_development, tutoring_center'$sql$;
END;
$$;
