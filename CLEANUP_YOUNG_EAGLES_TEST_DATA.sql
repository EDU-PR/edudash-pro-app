-- ============================================================================
-- CLEANUP TEST DATA FOR YOUNG EAGLES
-- ============================================================================
-- Run this on BOTH EduDashPro and EduSitePro databases
-- Young Eagles Organization ID: ba79097c-1b93-4b48-bcbe-df73878ab4d1
-- ============================================================================

BEGIN;

-- Store organization ID
\set young_eagles_id 'ba79097c-1b93-4b48-bcbe-df73878ab4d1'

-- ============================================================================
-- STEP 1: Delete from EduDashPro Database
-- ============================================================================

-- Get all parent IDs linked to Young Eagles
DO $$
DECLARE
    parent_ids UUID[];
    student_ids UUID[];
BEGIN
    -- Collect parent IDs
    SELECT ARRAY_AGG(DISTINCT id) INTO parent_ids
    FROM profiles
    WHERE preschool_id = 'ba79097c-1b93-4b48-bcbe-df73878ab4d1'
      AND role = 'parent';
    
    RAISE NOTICE 'Found % parent profiles to delete', COALESCE(array_length(parent_ids, 1), 0);
    
    -- Collect student IDs
    SELECT ARRAY_AGG(DISTINCT id) INTO student_ids
    FROM students
    WHERE preschool_id = 'ba79097c-1b93-4b48-bcbe-df73878ab4d1';
    
    RAISE NOTICE 'Found % student profiles to delete', COALESCE(array_length(student_ids, 1), 0);
    
    -- Delete class assignments for these students
    IF student_ids IS NOT NULL THEN
        DELETE FROM class_assignments WHERE student_id = ANY(student_ids);
        RAISE NOTICE 'Deleted class assignments';
    END IF;
    
    -- Delete students
    DELETE FROM students WHERE preschool_id = 'ba79097c-1b93-4b48-bcbe-df73878ab4d1';
    RAISE NOTICE 'Deleted students';
    
    -- Delete user_ai_tiers for these parents
    IF parent_ids IS NOT NULL THEN
        DELETE FROM user_ai_tiers WHERE user_id = ANY(parent_ids);
        RAISE NOTICE 'Deleted user_ai_tiers';
    END IF;
    
    -- Delete user_ai_usage for these parents
    IF parent_ids IS NOT NULL THEN
        DELETE FROM user_ai_usage WHERE user_id = ANY(parent_ids);
        RAISE NOTICE 'Deleted user_ai_usage';
    END IF;
    
    -- Delete auth users for these parents (requires auth.users admin access)
    -- This will cascade delete profiles due to FK constraint
    IF parent_ids IS NOT NULL THEN
        -- Note: This requires superuser or service_role access
        -- Run this separately if needed: DELETE FROM auth.users WHERE id = ANY(parent_ids);
        RAISE NOTICE 'Parent auth users need manual deletion (requires service_role)';
        RAISE NOTICE 'Parent IDs to delete: %', parent_ids;
    END IF;
    
    -- Delete profiles (if auth.users deletion didn't cascade)
    DELETE FROM profiles 
    WHERE preschool_id = 'ba79097c-1b93-4b48-bcbe-df73878ab4d1'
      AND role = 'parent';
    RAISE NOTICE 'Deleted parent profiles';
    
    -- Delete registration requests
    DELETE FROM registration_requests 
    WHERE organization_id = 'ba79097c-1b93-4b48-bcbe-df73878ab4d1';
    RAISE NOTICE 'Deleted registration requests';
    
END $$;

-- ============================================================================
-- STEP 2: Verify Cleanup
-- ============================================================================

SELECT 
    'registration_requests' as table_name,
    COUNT(*) as remaining_records
FROM registration_requests
WHERE organization_id = 'ba79097c-1b93-4b48-bcbe-df73878ab4d1'

UNION ALL

SELECT 
    'students',
    COUNT(*)
FROM students
WHERE preschool_id = 'ba79097c-1b93-4b48-bcbe-df73878ab4d1'

UNION ALL

SELECT 
    'profiles (parents)',
    COUNT(*)
FROM profiles
WHERE preschool_id = 'ba79097c-1b93-4b48-bcbe-df73878ab4d1'
  AND role = 'parent';

-- ============================================================================
-- COMMIT or ROLLBACK
-- ============================================================================
-- Review the output above, then uncomment ONE of these:

-- COMMIT;   -- Uncomment to apply changes
ROLLBACK; -- Uncomment to undo changes (default is rollback for safety)

