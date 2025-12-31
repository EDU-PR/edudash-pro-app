-- =====================================================
-- STUDENT REGISTRATION NOTIFICATION TRIGGER
-- Purpose: Notify principal when a new student is registered
-- Date: 2025-12-31
-- =====================================================

-- =====================================================
-- 1. NOTIFICATION TRIGGER FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION notify_principal_on_student_registration()
RETURNS TRIGGER AS $$
DECLARE
    principal_user_id UUID;
    school_name TEXT;
    student_name TEXT;
    notification_data JSONB;
BEGIN
    -- Get student's full name
    student_name := COALESCE(NEW.first_name || ' ' || NEW.last_name, 'New Student');
    
    -- Try to get principal from preschool first
    IF NEW.preschool_id IS NOT NULL THEN
        SELECT p.principal_id, p.name INTO principal_user_id, school_name
        FROM preschools p
        WHERE p.id = NEW.preschool_id;
    END IF;
    
    -- Fallback to organization principal if no preschool principal
    IF principal_user_id IS NULL AND NEW.organization_id IS NOT NULL THEN
        SELECT o.principal_id, o.name INTO principal_user_id, school_name
        FROM organizations o
        WHERE o.id = NEW.organization_id;
    END IF;
    
    -- If no principal found, skip notification
    IF principal_user_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Build notification data
    notification_data := jsonb_build_object(
        'type', 'student_registered',
        'student_id', NEW.id,
        'student_name', student_name,
        'student_code', NEW.student_id,
        'preschool_id', NEW.preschool_id,
        'organization_id', NEW.organization_id,
        'class_id', NEW.class_id,
        'academic_year', NEW.academic_year,
        'action_url', '/dashboard/principal/students',
        'channel', 'educational',
        'priority', 'default'
    );
    
    -- Insert push notification for principal
    BEGIN
        INSERT INTO push_notifications (
            recipient_user_id,
            title,
            body,
            notification_type,
            preschool_id,
            status,
            data
        ) VALUES (
            principal_user_id,
            '🎉 New Student Registered',
            student_name || ' has been registered at ' || COALESCE(school_name, 'your school') || '. Student ID: ' || COALESCE(NEW.student_id, 'Pending'),
            'student_registered',
            NEW.preschool_id,
            'pending',
            notification_data
        );
    EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail the registration
        RAISE WARNING 'Failed to create registration notification: %', SQLERRM;
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. CREATE TRIGGER
-- =====================================================

-- Drop trigger if exists to allow re-running migration
DROP TRIGGER IF EXISTS trg_notify_principal_on_student_registration ON students;

-- Create trigger to fire after student insert
CREATE TRIGGER trg_notify_principal_on_student_registration
    AFTER INSERT ON students
    FOR EACH ROW
    EXECUTE FUNCTION notify_principal_on_student_registration();

-- =====================================================
-- 3. BACKFILL STUDENT_IDS FOR EXISTING STUDENTS
-- =====================================================

-- Function to backfill missing student_id values
CREATE OR REPLACE FUNCTION backfill_missing_student_ids()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER := 0;
    student_record RECORD;
    org_code VARCHAR(10);
    year_val VARCHAR(4);
    counter INT;
    new_student_id VARCHAR(50);
BEGIN
    -- Loop through students without student_id
    FOR student_record IN 
        SELECT s.id, s.organization_id, s.academic_year
        FROM students s
        WHERE s.student_id IS NULL
        ORDER BY s.created_at ASC
    LOOP
        -- Get organization school code
        SELECT school_code INTO org_code 
        FROM organizations 
        WHERE id = student_record.organization_id;
        
        -- Use academic year or default to current year
        year_val := COALESCE(student_record.academic_year, EXTRACT(YEAR FROM CURRENT_DATE)::TEXT);
        
        -- Get next counter for this org and year
        SELECT COUNT(*) + 1 INTO counter
        FROM students
        WHERE organization_id = student_record.organization_id
          AND academic_year = year_val
          AND student_id IS NOT NULL;
        
        -- Generate ID: ORG-YEAR-NNNN (use first 2-3 chars of name if no school_code)
        IF org_code IS NULL THEN
            SELECT UPPER(LEFT(REPLACE(name, ' ', ''), 3)) INTO org_code
            FROM organizations
            WHERE id = student_record.organization_id;
        END IF;
        
        org_code := COALESCE(org_code, 'EDU');
        new_student_id := org_code || '-' || year_val || '-' || LPAD(counter::TEXT, 4, '0');
        
        -- Update the student record
        UPDATE students 
        SET student_id = new_student_id
        WHERE id = student_record.id;
        
        updated_count := updated_count + 1;
    END LOOP;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Run the backfill
DO $$
DECLARE
    backfilled INTEGER;
BEGIN
    SELECT backfill_missing_student_ids() INTO backfilled;
    RAISE NOTICE 'Backfilled student_id for % students', backfilled;
END $$;

-- Clean up the backfill function (one-time use)
DROP FUNCTION IF EXISTS backfill_missing_student_ids();

-- =====================================================
-- 4. COMMENTS
-- =====================================================

COMMENT ON FUNCTION notify_principal_on_student_registration() IS 
    'Sends push notification to principal when a new student is registered. Falls back from preschool principal to organization principal.';

COMMENT ON TRIGGER trg_notify_principal_on_student_registration ON students IS 
    'Fires after student INSERT to notify the school principal of new registration.';
