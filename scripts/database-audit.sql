-- =============================================================================
-- EDUDASH PRO - COMPREHENSIVE DATABASE AUDIT SCRIPT
-- =============================================================================
-- Purpose: Systematically check for all known database issues
-- Date: 2025-01-XX
-- Run via: psql -h aws-0-ap-southeast-1.pooler.supabase.com -p 6543 -U postgres.lvvvjywrmpcqrpvuptdi -d postgres -f scripts/database-audit.sql
-- =============================================================================

\echo '============================================================================='
\echo 'EDUDASH PRO DATABASE AUDIT - STARTING'
\echo '============================================================================='
\echo ''

-- =============================================================================
-- 1. MISSING TABLES CHECK
-- =============================================================================
\echo '1. CHECKING FOR MISSING TABLES...'
\echo ''

SELECT 
    'MISSING_TABLES' as check_type,
    table_name,
    'CRITICAL' as severity,
    CASE 
        WHEN table_name IN ('learner_connections', 'study_groups', 'assignment_submissions', 'learner_cvs', 'portfolio_items') 
        THEN 'Learner Features Migration'
        WHEN table_name IN ('seats', 'lesson_activities', 'activity_attempts', 'parent_child_links', 'child_registration_requests', 'parent_payments', 'subscription_invoices', 'payfast_itn_logs', 'push_notifications', 'ad_impressions', 'org_invites')
        THEN 'Core Features Migration'
        ELSE 'Unknown'
    END as migration_source
FROM (VALUES 
    -- Learner Features (from 20251213000000_learner_features_foundation.sql)
    ('learner_connections'),
    ('study_groups'),
    ('assignment_submissions'),
    ('learner_cvs'),
    ('portfolio_items'),
    -- Core Features (from FIX_ALL_DATABASE_ISSUES.sql)
    ('seats'),
    ('lesson_activities'),
    ('activity_attempts'),
    ('parent_child_links'),
    ('child_registration_requests'),
    ('parent_payments'),
    ('subscription_invoices'),
    ('payfast_itn_logs'),
    ('push_notifications'),
    ('ad_impressions'),
    ('org_invites')
) AS expected_tables(table_name)
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = expected_tables.table_name
)
ORDER BY table_name;

\echo ''

-- =============================================================================
-- 2. MISSING COLUMNS CHECK
-- =============================================================================
\echo '2. CHECKING FOR MISSING COLUMNS...'
\echo ''

SELECT 
    'MISSING_COLUMNS' as check_type,
    table_name,
    column_name,
    'CRITICAL' as severity,
    CASE 
        WHEN table_name = 'profiles' AND column_name = 'capabilities' THEN 'Required for role-based access control'
        WHEN table_name = 'push_devices' AND column_name = 'device_id' THEN 'Required for device identification'
        ELSE 'Unknown requirement'
    END as description
FROM (VALUES 
    ('profiles', 'capabilities'),
    ('push_devices', 'device_id')
) AS expected_columns(table_name, column_name)
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = expected_columns.table_name
    AND column_name = expected_columns.column_name
)
ORDER BY table_name, column_name;

\echo ''

-- =============================================================================
-- 3. RLS (ROW LEVEL SECURITY) STATUS CHECK
-- =============================================================================
\echo '3. CHECKING RLS STATUS ON CRITICAL TABLES...'
\echo ''

-- 3.1 Tables with RLS disabled (CRITICAL)
SELECT 
    'RLS_DISABLED' as check_type,
    tablename as table_name,
    'CRITICAL' as severity,
    'RLS is disabled - security risk' as description
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'users', 'profiles', 'preschools', 'subscriptions', 'classes',
    'learner_connections', 'study_groups', 'assignment_submissions', 
    'learner_cvs', 'portfolio_items', 'seats', 'lesson_activities',
    'activity_attempts', 'parent_child_links', 'child_registration_requests',
    'parent_payments', 'subscription_invoices', 'push_notifications',
    'org_invites', 'homework_assignments', 'lessons'
)
AND NOT rowsecurity
ORDER BY tablename;

\echo ''

-- 3.2 Tables with RLS enabled but no policies (WARNING - blocks all access)
SELECT 
    'RLS_NO_POLICIES' as check_type,
    t.tablename as table_name,
    'WARNING' as severity,
    'RLS enabled but no policies exist - all access blocked' as description
FROM pg_tables t
WHERE t.schemaname = 'public' 
AND t.rowsecurity = true
AND NOT EXISTS (
    SELECT 1 FROM pg_policies p 
    WHERE p.schemaname = 'public' 
    AND p.tablename = t.tablename
)
ORDER BY t.tablename;

\echo ''

-- 3.3 Critical users table RLS status (SPECIAL CHECK)
SELECT 
    'USERS_RLS_STATUS' as check_type,
    tablename as table_name,
    CASE 
        WHEN rowsecurity THEN 'INFO' 
        ELSE 'CRITICAL' 
    END as severity,
    CASE 
        WHEN rowsecurity THEN 'RLS is enabled'
        ELSE 'RLS is DISABLED - was temporarily disabled for diagnostics'
    END as description,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public') as policy_count
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'users';

\echo ''

-- =============================================================================
-- 4. MIGRATION STATUS CHECK
-- =============================================================================
\echo '4. CHECKING MIGRATION STATUS...'
\echo ''

-- Check if schema_migrations table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations') THEN
        RAISE NOTICE 'Migration tracking table exists';
    ELSE
        RAISE NOTICE 'WARNING: Migration tracking table does not exist';
    END IF;
END $$;

-- List applied migrations (if table exists)
SELECT 
    'APPLIED_MIGRATIONS' as check_type,
    version,
    name,
    'INFO' as severity
FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 20;

\echo ''

-- =============================================================================
-- 5. FOREIGN KEY CONSTRAINTS CHECK
-- =============================================================================
\echo '5. CHECKING FOREIGN KEY CONSTRAINTS...'
\echo ''

-- 5.1 Check for orphaned records in learner_connections (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'learner_connections') THEN
        PERFORM 1 FROM learner_connections lc
        WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = lc.learner_id)
           OR NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = lc.connection_id)
        LIMIT 1;
        
        IF FOUND THEN
            RAISE NOTICE 'WARNING: Orphaned records found in learner_connections';
        END IF;
    END IF;
END $$;

-- 5.2 Check for orphaned records in assignment_submissions (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assignment_submissions') THEN
        PERFORM 1 FROM assignment_submissions asub
        WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = asub.learner_id)
        LIMIT 1;
        
        IF FOUND THEN
            RAISE NOTICE 'WARNING: Orphaned records found in assignment_submissions';
        END IF;
    END IF;
END $$;

-- 5.3 Check for broken foreign key references in critical tables
SELECT 
    'BROKEN_FK' as check_type,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    'WARNING' as severity,
    'Foreign key constraint may be broken' as description
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_schema = 'public'
AND tc.table_name IN (
    'learner_connections', 'study_groups', 'assignment_submissions',
    'learner_cvs', 'portfolio_items', 'seats', 'lesson_activities',
    'activity_attempts', 'parent_child_links', 'child_registration_requests'
)
ORDER BY tc.table_name, kcu.column_name;

\echo ''

-- =============================================================================
-- 6. MISSING INDEXES CHECK
-- =============================================================================
\echo '6. CHECKING FOR MISSING INDEXES...'
\echo ''

-- 6.1 Check for foreign keys without indexes (performance issue)
SELECT 
    'MISSING_FK_INDEX' as check_type,
    tc.table_name,
    kcu.column_name,
    'WARNING' as severity,
    'Foreign key column missing index - performance impact' as description
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_schema = 'public'
AND tc.table_name IN (
    'learner_connections', 'study_groups', 'assignment_submissions',
    'learner_cvs', 'portfolio_items'
)
AND NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = tc.table_name
    AND indexdef LIKE '%' || kcu.column_name || '%'
)
ORDER BY tc.table_name, kcu.column_name;

\echo ''

-- =============================================================================
-- 7. DATA INTEGRITY ISSUES
-- =============================================================================
\echo '7. CHECKING DATA INTEGRITY...'
\echo ''

-- 7.1 Check for NULL values in required columns (if tables exist)
DO $$
BEGIN
    -- Check learner_connections
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'learner_connections') THEN
        PERFORM 1 FROM learner_connections 
        WHERE learner_id IS NULL OR connection_id IS NULL OR connection_type IS NULL
        LIMIT 1;
        
        IF FOUND THEN
            RAISE NOTICE 'WARNING: NULL values in required columns of learner_connections';
        END IF;
    END IF;
    
    -- Check assignment_submissions
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assignment_submissions') THEN
        PERFORM 1 FROM assignment_submissions 
        WHERE learner_id IS NULL
        LIMIT 1;
        
        IF FOUND THEN
            RAISE NOTICE 'WARNING: NULL values in required columns of assignment_submissions';
        END IF;
    END IF;
    
    -- Check learner_cvs
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'learner_cvs') THEN
        PERFORM 1 FROM learner_cvs 
        WHERE learner_id IS NULL OR title IS NULL
        LIMIT 1;
        
        IF FOUND THEN
            RAISE NOTICE 'WARNING: NULL values in required columns of learner_cvs';
        END IF;
    END IF;
END $$;

\echo ''

-- =============================================================================
-- 8. SCHEMA MISMATCHES - CHECK CRITICAL COLUMN TYPES
-- =============================================================================
\echo '8. CHECKING SCHEMA CONSISTENCY...'
\echo ''

-- Check if capabilities column has correct type (if exists)
SELECT 
    'SCHEMA_TYPE_CHECK' as check_type,
    table_name,
    column_name,
    data_type,
    'WARNING' as severity,
    CASE 
        WHEN data_type != 'jsonb' THEN 'Expected jsonb type'
        ELSE 'Type is correct'
    END as description
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'profiles'
AND column_name = 'capabilities'
AND data_type != 'jsonb';

-- Check if device_id column exists and has correct type (if exists)
SELECT 
    'SCHEMA_TYPE_CHECK' as check_type,
    table_name,
    column_name,
    data_type,
    'WARNING' as severity,
    CASE 
        WHEN data_type NOT IN ('text', 'character varying') THEN 'Expected text type'
        ELSE 'Type is correct'
    END as description
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'push_devices'
AND column_name = 'device_id'
AND data_type NOT IN ('text', 'character varying');

\echo ''

-- =============================================================================
-- 9. SUMMARY REPORT
-- =============================================================================
\echo '============================================================================='
\echo 'AUDIT SUMMARY'
\echo '============================================================================='
\echo ''

-- Count missing tables
SELECT 
    'SUMMARY' as check_type,
    'Missing Tables' as category,
    COUNT(*)::text as count,
    'CRITICAL' as severity
FROM (VALUES 
    ('learner_connections'), ('study_groups'), ('assignment_submissions'),
    ('learner_cvs'), ('portfolio_items'), ('seats'), ('lesson_activities'),
    ('activity_attempts'), ('parent_child_links'), ('child_registration_requests'),
    ('parent_payments'), ('subscription_invoices'), ('payfast_itn_logs'),
    ('push_notifications'), ('ad_impressions'), ('org_invites')
) AS expected_tables(table_name)
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = expected_tables.table_name
);

-- Count missing columns
SELECT 
    'SUMMARY' as check_type,
    'Missing Columns' as category,
    COUNT(*)::text as count,
    'CRITICAL' as severity
FROM (VALUES 
    ('profiles', 'capabilities'),
    ('push_devices', 'device_id')
) AS expected_columns(table_name, column_name)
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = expected_columns.table_name
    AND column_name = expected_columns.column_name
);

-- Count tables with RLS disabled
SELECT 
    'SUMMARY' as check_type,
    'Tables with RLS Disabled' as category,
    COUNT(*)::text as count,
    'CRITICAL' as severity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'users', 'profiles', 'preschools', 'subscriptions', 'classes',
    'learner_connections', 'study_groups', 'assignment_submissions', 
    'learner_cvs', 'portfolio_items', 'seats', 'lesson_activities',
    'activity_attempts', 'parent_child_links', 'child_registration_requests',
    'parent_payments', 'subscription_invoices', 'push_notifications',
    'org_invites', 'homework_assignments', 'lessons'
)
AND NOT rowsecurity;

-- Count tables with RLS but no policies
SELECT 
    'SUMMARY' as check_type,
    'Tables with RLS but No Policies' as category,
    COUNT(*)::text as count,
    'WARNING' as severity
FROM pg_tables t
WHERE t.schemaname = 'public' 
AND t.rowsecurity = true
AND NOT EXISTS (
    SELECT 1 FROM pg_policies p 
    WHERE p.schemaname = 'public' 
    AND p.tablename = t.tablename
);

\echo ''
\echo '============================================================================='
\echo 'AUDIT COMPLETE'
\echo '============================================================================='
\echo 'Review the output above for all issues.'
\echo 'CRITICAL issues must be fixed immediately.'
\echo 'WARNING issues should be addressed soon.'
\echo 'INFO issues are for reference.'
\echo ''

