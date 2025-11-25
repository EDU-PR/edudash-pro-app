-- Create function to automatically assign students to age-appropriate classes
-- Based on Young Eagles structure:
-- Little Explorers: 6 months - 1 year (0-1)
-- Curious Cubs: 1-3 years
-- Panda: 4-6 years

CREATE OR REPLACE FUNCTION assign_student_to_class(
  p_student_id UUID,
  p_preschool_id UUID,
  p_date_of_birth DATE
)
RETURNS UUID AS $$
DECLARE
  v_age_years INTEGER;
  v_class_id UUID;
BEGIN
  -- Calculate age in years
  v_age_years := EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_date_of_birth));
  
  -- Find appropriate class based on age
  SELECT id INTO v_class_id
  FROM classes
  WHERE preschool_id = p_preschool_id
    AND active = true
    AND v_age_years >= age_min
    AND v_age_years <= age_max
  ORDER BY age_min
  LIMIT 1;
  
  -- If class found, assign student
  IF v_class_id IS NOT NULL THEN
    UPDATE students
    SET class_id = v_class_id
    WHERE id = p_student_id;
    
    RETURN v_class_id;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION assign_student_to_class IS 
  'Automatically assigns a student to the appropriate class based on their age';

-- Create trigger to auto-assign class when student is created or DOB is updated
CREATE OR REPLACE FUNCTION trigger_assign_student_class()
RETURNS TRIGGER AS $$
BEGIN
  -- Only auto-assign if preschool_id and date_of_birth exist, and class_id is null
  IF NEW.preschool_id IS NOT NULL 
     AND NEW.date_of_birth IS NOT NULL 
     AND NEW.class_id IS NULL THEN
    
    NEW.class_id := assign_student_to_class(
      NEW.id,
      NEW.preschool_id,
      NEW.date_of_birth
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS auto_assign_student_class ON students;

CREATE TRIGGER auto_assign_student_class
  BEFORE INSERT OR UPDATE OF date_of_birth, preschool_id
  ON students
  FOR EACH ROW
  EXECUTE FUNCTION trigger_assign_student_class();

-- Grant execute permission
GRANT EXECUTE ON FUNCTION assign_student_to_class TO authenticated, service_role;

-- Test: Reassign existing students to correct classes
DO $$
DECLARE
  student_record RECORD;
  assigned_class_id UUID;
BEGIN
  FOR student_record IN 
    SELECT id, preschool_id, date_of_birth 
    FROM students 
    WHERE preschool_id IS NOT NULL 
      AND date_of_birth IS NOT NULL
  LOOP
    assigned_class_id := assign_student_to_class(
      student_record.id,
      student_record.preschool_id,
      student_record.date_of_birth
    );
    
    IF assigned_class_id IS NOT NULL THEN
      RAISE NOTICE 'Assigned student % to class %', student_record.id, assigned_class_id;
    END IF;
  END LOOP;
END $$;

SELECT 'SUCCESS: Auto-assign class function and trigger created' AS status;

-- Show Young Eagles students with their assigned classes
SELECT 
  s.first_name || ' ' || s.last_name as student_name,
  EXTRACT(YEAR FROM AGE(s.date_of_birth)) as age,
  c.name as class_name,
  c.age_group
FROM students s
LEFT JOIN classes c ON s.class_id = c.id
WHERE s.preschool_id = 'ba79097c-1b93-4b48-bcbe-df73878ab4d1'::uuid
ORDER BY age;
