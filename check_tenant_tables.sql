-- Check existing tenant/organization/student structure
-- Run this after connecting: psql -h aws-0-ap-southeast-1.pooler.supabase.com -p 6543 -d postgres -U postgres.bppuzibjlxgfwrujzfsz

\echo '=== Existing Tenant/Organization/Student Tables ==='
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name LIKE '%tenant%' 
     OR table_name LIKE '%organization%' 
     OR table_name LIKE '%preschool%'
     OR table_name LIKE '%student%'
     OR table_name LIKE '%registration%')
ORDER BY table_name;

\echo ''
\echo '=== Profiles Table Structure ==='
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'profiles'
ORDER BY ordinal_position;

\echo ''
\echo '=== Check if students table exists ==='
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'students'
) AS students_table_exists;
