-- ============================================================================
-- Membership System Database Audit Script
-- Purpose: Verify all tables, functions, RLS policies for the membership system
-- Date: 2025-12-23
-- ============================================================================

\echo '';
\echo '========================================';
\echo 'MEMBERSHIP SYSTEM DATABASE AUDIT';
\echo '========================================';
\echo '';

-- ============================================================================
-- SECTION 1: Core Tables Verification
-- ============================================================================

\echo '1. CORE MEMBERSHIP TABLES';
\echo '========================================';

SELECT 
    table_name,
    CASE 
        WHEN table_name IS NOT NULL THEN '✓ EXISTS'
        ELSE '✗ MISSING'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'organizations',
    'organization_regions',
    'organization_members',
    'organization_roles',
    'member_id_cards',
    'resource_categories',
    'resources',
    'membership_fee_structures',
    'member_invoices',
    'member_payments',
    'organization_events',
    'event_registrations',
    'member_activity_log',
    'profiles'
)
ORDER BY table_name;

-- ============================================================================
-- SECTION 2: Organization Table Structure
-- ============================================================================

\echo '';
\echo '2. ORGANIZATIONS TABLE COLUMNS';
\echo '========================================';

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'organizations'
ORDER BY ordinal_position;

-- ============================================================================
-- SECTION 3: Organization Members Table Structure
-- ============================================================================

\echo '';
\echo '3. ORGANIZATION_MEMBERS TABLE COLUMNS';
\echo '========================================';

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'organization_members'
ORDER BY ordinal_position;

-- ============================================================================
-- SECTION 4: RLS Status Check
-- ============================================================================

\echo '';
\echo '4. RLS STATUS ON MEMBERSHIP TABLES';
\echo '========================================';

SELECT 
    pt.tablename,
    pc.rowsecurity as rls_enabled,
    CASE 
        WHEN pc.rowsecurity THEN '✓ ENABLED'
        ELSE '✗ DISABLED'
    END as status
FROM pg_tables pt
JOIN pg_class pc ON pc.relname = pt.tablename
JOIN pg_namespace pn ON pc.relnamespace = pn.oid
WHERE pn.nspname = 'public'
AND pt.tablename IN (
    'organizations',
    'organization_regions',
    'organization_members',
    'organization_roles',
    'member_id_cards',
    'resource_categories',
    'resources',
    'membership_fee_structures',
    'member_invoices',
    'member_payments',
    'organization_events',
    'event_registrations',
    'member_activity_log'
)
ORDER BY pt.tablename;

-- ============================================================================
-- SECTION 5: RLS Policies Count
-- ============================================================================

\echo '';
\echo '5. RLS POLICIES PER TABLE';
\echo '========================================';

SELECT 
    tablename,
    COUNT(*) as policy_count,
    array_agg(policyname) as policies
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
    'organizations',
    'organization_regions',
    'organization_members',
    'member_id_cards',
    'resources',
    'member_invoices',
    'member_payments',
    'organization_events',
    'event_registrations'
)
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- SECTION 6: Required Functions Check
-- ============================================================================

\echo '';
\echo '6. MEMBERSHIP FUNCTIONS';
\echo '========================================';

SELECT 
    routine_name,
    routine_type,
    CASE 
        WHEN routine_name IS NOT NULL THEN '✓ EXISTS'
        ELSE '✗ MISSING'
    END as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'create_organization',
    'generate_member_number',
    'generate_card_number',
    'generate_qr_verification_data',
    'generate_invoice_number',
    'trigger_generate_member_number',
    'update_updated_at_column'
)
ORDER BY routine_name;

-- ============================================================================
-- SECTION 7: Foreign Key Relationships
-- ============================================================================

\echo '';
\echo '7. FOREIGN KEYS ON MEMBERSHIP TABLES';
\echo '========================================';

SELECT 
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table,
    ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
AND tc.table_name IN (
    'organization_members',
    'member_id_cards',
    'resources',
    'member_invoices',
    'member_payments',
    'organization_events',
    'event_registrations'
)
ORDER BY tc.table_name, tc.constraint_name;

-- ============================================================================
-- SECTION 8: Indexes on Membership Tables
-- ============================================================================

\echo '';
\echo '8. INDEXES ON MEMBERSHIP TABLES';
\echo '========================================';

SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN (
    'organization_members',
    'member_id_cards',
    'organization_regions',
    'resources',
    'member_invoices',
    'organization_events'
)
ORDER BY tablename, indexname;

-- ============================================================================
-- SECTION 9: Check Profiles Table has organization_id
-- ============================================================================

\echo '';
\echo '9. PROFILES TABLE - ORG LINKAGE';
\echo '========================================';

SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'profiles'
AND column_name IN ('organization_id', 'preschool_id', 'role')
ORDER BY column_name;

-- ============================================================================
-- SECTION 10: Triggers
-- ============================================================================

\echo '';
\echo '10. TRIGGERS ON MEMBERSHIP TABLES';
\echo '========================================';

SELECT 
    event_object_table as table_name,
    trigger_name,
    action_timing,
    event_manipulation
FROM information_schema.triggers
WHERE event_object_schema = 'public'
AND event_object_table IN (
    'organization_members',
    'member_id_cards',
    'organization_regions',
    'resources',
    'organization_events'
)
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- SECTION 11: Summary
-- ============================================================================

\echo '';
\echo '========================================';
\echo 'AUDIT COMPLETE';
\echo '========================================';
\echo '';
