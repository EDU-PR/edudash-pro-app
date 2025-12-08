-- =====================================================
-- CLASS ENROLLMENT MANAGEMENT FUNCTIONS
-- Purpose: Helper functions for managing class enrollment counts
-- =====================================================

-- Function to increment class enrollment count
CREATE OR REPLACE FUNCTION increment_class_enrollment(class_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE classes
  SET 
    current_students = COALESCE(current_students, 0) + 1,
    updated_at = NOW()
  WHERE id = class_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION increment_class_enrollment IS 'Increments the current_students count for a class when a student is enrolled';

-- Function to decrement class enrollment count
CREATE OR REPLACE FUNCTION decrement_class_enrollment(class_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE classes
  SET 
    current_students = GREATEST(COALESCE(current_students, 0) - 1, 0),
    updated_at = NOW()
  WHERE id = class_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION decrement_class_enrollment IS 'Decrements the current_students count for a class when a student leaves or is withdrawn';

-- Function to recalculate class enrollment (for data cleanup/verification)
CREATE OR REPLACE FUNCTION recalculate_class_enrollment(class_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  actual_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO actual_count
  FROM students
  WHERE class_id = class_uuid
    AND status IN ('active', 'enrolled');
  
  UPDATE classes
  SET 
    current_students = actual_count,
    updated_at = NOW()
  WHERE id = class_uuid;
  
  RETURN actual_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION recalculate_class_enrollment IS 'Recalculates the current_students count based on actual student records. Useful for data integrity checks.';

-- Function to recalculate all class enrollments for a preschool
CREATE OR REPLACE FUNCTION recalculate_all_class_enrollments(preschool_uuid UUID)
RETURNS TABLE(class_id UUID, class_name VARCHAR, old_count INTEGER, new_count INTEGER) AS $$
BEGIN
  RETURN QUERY
  WITH counts AS (
    SELECT 
      c.id,
      c.name,
      c.current_students as old_count,
      COUNT(s.id) as new_count
    FROM classes c
    LEFT JOIN students s ON s.class_id = c.id AND s.status IN ('active', 'enrolled')
    WHERE c.preschool_id = preschool_uuid
    GROUP BY c.id, c.name, c.current_students
  )
  UPDATE classes
  SET 
    current_students = counts.new_count,
    updated_at = NOW()
  FROM counts
  WHERE classes.id = counts.id
  RETURNING classes.id, counts.name, counts.old_count, counts.new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION recalculate_all_class_enrollments IS 'Recalculates enrollment counts for all classes in a preschool. Returns old and new counts for verification.';

-- Trigger to automatically update class enrollment when student status changes
CREATE OR REPLACE FUNCTION update_class_enrollment_on_student_change()
RETURNS TRIGGER AS $$
BEGIN
  -- When a student is inserted with active/enrolled status
  IF (TG_OP = 'INSERT' AND NEW.status IN ('active', 'enrolled') AND NEW.class_id IS NOT NULL) THEN
    PERFORM increment_class_enrollment(NEW.class_id);
  END IF;

  -- When a student's status changes
  IF (TG_OP = 'UPDATE') THEN
    -- Student moved from active/enrolled to inactive/graduated/withdrawn
    IF (OLD.status IN ('active', 'enrolled') AND NEW.status NOT IN ('active', 'enrolled')) THEN
      IF OLD.class_id IS NOT NULL THEN
        PERFORM decrement_class_enrollment(OLD.class_id);
      END IF;
    END IF;
    
    -- Student moved from inactive/graduated/withdrawn to active/enrolled
    IF (OLD.status NOT IN ('active', 'enrolled') AND NEW.status IN ('active', 'enrolled')) THEN
      IF NEW.class_id IS NOT NULL THEN
        PERFORM increment_class_enrollment(NEW.class_id);
      END IF;
    END IF;
    
    -- Student moved to a different class (while active/enrolled)
    IF (NEW.status IN ('active', 'enrolled') AND OLD.class_id IS DISTINCT FROM NEW.class_id) THEN
      IF OLD.class_id IS NOT NULL THEN
        PERFORM decrement_class_enrollment(OLD.class_id);
      END IF;
      IF NEW.class_id IS NOT NULL THEN
        PERFORM increment_class_enrollment(NEW.class_id);
      END IF;
    END IF;
  END IF;

  -- When a student is deleted
  IF (TG_OP = 'DELETE' AND OLD.status IN ('active', 'enrolled') AND OLD.class_id IS NOT NULL) THEN
    PERFORM decrement_class_enrollment(OLD.class_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on students table
DROP TRIGGER IF EXISTS trigger_update_class_enrollment ON students;
CREATE TRIGGER trigger_update_class_enrollment
AFTER INSERT OR UPDATE OR DELETE ON students
FOR EACH ROW
EXECUTE FUNCTION update_class_enrollment_on_student_change();

COMMENT ON TRIGGER trigger_update_class_enrollment ON students IS 'Automatically updates class enrollment counts when students are added, removed, or change status';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_class_enrollment TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_class_enrollment TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_class_enrollment TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_all_class_enrollments TO authenticated;
